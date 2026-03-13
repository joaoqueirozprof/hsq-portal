import { useRef, useCallback } from 'react';
import { calcBearing } from '../utils/vehicleIcons';

interface AnimationState {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  startCourse: number;
  endCourse: number;
  startTime: number;
  duration: number;
  animFrame: number | null;
}

interface Position {
  lat: number;
  lng: number;
  course: number;
}

const ANIMATION_DURATION = 9000; // 9 seconds, synced with GT06 10s reporting interval
const MIN_DISTANCE = 1; // meters
const MAX_DISTANCE = 10000; // 10km - threshold for detecting GPS jumps

/**
 * Ease-in-out cubic interpolation
 * Provides smooth acceleration and deceleration
 */
const easeInOutCubic = (progress: number): number => {
  if (progress < 0.5) {
    return 4 * progress * progress * progress;
  }
  return 1 - Math.pow(-2 * progress + 2, 3) / 2;
};

/**
 * Calculate distance between two coordinates in meters
 */
const getDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Normalize angle to 0-360 range
 */
const normalizeAngle = (angle: number): number => {
  return ((angle % 360) + 360) % 360;
};

/**
 * Calculate shortest rotational distance between two angles
 */
const getShortestAngleDifference = (startAngle: number, endAngle: number): number => {
  let diff = normalizeAngle(endAngle - startAngle);
  if (diff > 180) {
    diff -= 360;
  }
  return diff;
};

export const useVehicleAnimation = () => {
  const vehicleAnimations = useRef<Map<string, AnimationState>>(new Map());
  const previousPositions = useRef<Map<string, Position>>(new Map());
  const animFrameIds = useRef<Set<number>>(new Set());

  /**
   * Animate vehicle marker with interpolated position and rotation
   */
  const animateVehicleMarker = useCallback(
    (
      deviceId: string,
      markers: Map<string, any>,
      onMapPan?: (lat: number, lng: number) => void,
      selectedVehicleId?: string,
    ) => {
      const animation = vehicleAnimations.current.get(deviceId);
      if (!animation) return;

      const marker = markers.get(deviceId);
      if (!marker) return;

      const now = Date.now();
      const elapsed = Math.min(now - animation.startTime, animation.duration);
      const progress = elapsed / animation.duration;
      const easedProgress = easeInOutCubic(progress);

      // Interpolate latitude and longitude
      const currentLat =
        animation.startLat + (animation.endLat - animation.startLat) * easedProgress;
      const currentLng =
        animation.startLng + (animation.endLng - animation.startLng) * easedProgress;

      // Interpolate course (rotation) using shortest path
      const angleDiff = getShortestAngleDifference(animation.startCourse, animation.endCourse);
      const currentCourse = normalizeAngle(animation.startCourse + angleDiff * easedProgress);

      // Update marker position
      marker.setLatLng([currentLat, currentLng]);

      // Pan map if vehicle is selected
      if (selectedVehicleId === deviceId && onMapPan) {
        onMapPan(currentLat, currentLng);
      }

      // Continue animation or complete it
      if (progress < 1) {
        const nextFrame = requestAnimationFrame(() => {
          animateVehicleMarker(deviceId, markers, onMapPan, selectedVehicleId);
        });
        animation.animFrame = nextFrame;
        animFrameIds.current.add(nextFrame);
      } else {
        // Animation complete - store final position
        previousPositions.current.set(deviceId, {
          lat: animation.endLat,
          lng: animation.endLng,
          course: animation.endCourse,
        });
        vehicleAnimations.current.delete(deviceId);
        if (animation.animFrame !== null) {
          animFrameIds.current.delete(animation.animFrame);
        }
      }
    },
    [],
  );

  /**
   * Start animation for a vehicle to a new position
   */
  const startVehicleAnimation = useCallback(
    (
      deviceId: string,
      newLat: number,
      newLng: number,
      newCourse: number,
      markers: Map<string, any>,
    ): boolean => {
      const marker = markers.get(deviceId);
      if (!marker) return false;

      let startLat = newLat;
      let startLng = newLng;
      let startCourse = newCourse;

      // If animation is running, use current interpolated position
      const runningAnimation = vehicleAnimations.current.get(deviceId);
      if (runningAnimation) {
        const now = Date.now();
        const elapsed = Math.min(now - runningAnimation.startTime, runningAnimation.duration);
        const progress = elapsed / runningAnimation.duration;
        const easedProgress = easeInOutCubic(progress);

        startLat =
          runningAnimation.startLat +
          (runningAnimation.endLat - runningAnimation.startLat) * easedProgress;
        startLng =
          runningAnimation.startLng +
          (runningAnimation.endLng - runningAnimation.startLng) * easedProgress;

        const angleDiff = getShortestAngleDifference(
          runningAnimation.startCourse,
          runningAnimation.endCourse,
        );
        startCourse = normalizeAngle(
          runningAnimation.startCourse + angleDiff * easedProgress,
        );

        // Cancel previous animation frame
        if (runningAnimation.animFrame !== null) {
          cancelAnimationFrame(runningAnimation.animFrame);
          animFrameIds.current.delete(runningAnimation.animFrame);
        }
      } else {
        // If no animation running, check for previous position
        const prevPosition = previousPositions.current.get(deviceId);
        if (!prevPosition) {
          // First position, just store and return false
          previousPositions.current.set(deviceId, {
            lat: newLat,
            lng: newLng,
            course: newCourse,
          });
          return false;
        }

        startLat = prevPosition.lat;
        startLng = prevPosition.lng;
        startCourse = prevPosition.course;
      }

      // Check distance for GPS jump detection
      const distance = getDistance(startLat, startLng, newLat, newLng);
      if (distance < MIN_DISTANCE || distance > MAX_DISTANCE) {
        // Jump detected or no movement - just update position without animation
        previousPositions.current.set(deviceId, {
          lat: newLat,
          lng: newLng,
          course: newCourse,
        });
        marker.setLatLng([newLat, newLng]);
        return false;
      }

      // If course is 0, calculate from bearing
      let finalCourse = newCourse;
      if (finalCourse === 0) {
        finalCourse = calcBearing(startLat, startLng, newLat, newLng);
      }

      // Create animation state
      const animationState: AnimationState = {
        startLat,
        startLng,
        endLat: newLat,
        endLng: newLng,
        startCourse,
        endCourse: finalCourse,
        startTime: Date.now(),
        duration: ANIMATION_DURATION,
        animFrame: null,
      };

      vehicleAnimations.current.set(deviceId, animationState);

      // Start animation
      const animFrame = requestAnimationFrame(() => {
        animateVehicleMarker(deviceId, markers);
      });
      animationState.animFrame = animFrame;
      animFrameIds.current.add(animFrame);

      return true;
    },
    [animateVehicleMarker],
  );

  /**
   * Cleanup function to cancel all animation frames
   */
  const cleanup = useCallback(() => {
    animFrameIds.current.forEach((frameId) => {
      cancelAnimationFrame(frameId);
    });
    animFrameIds.current.clear();
    vehicleAnimations.current.clear();
  }, []);

  return {
    startAnimation: startVehicleAnimation,
    animateMarker: animateVehicleMarker,
    cleanup,
    previousPositions: previousPositions.current,
  };
};
