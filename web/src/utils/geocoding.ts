const cache = new Map<string, string>();
let isProcessing = false;
const queue: Array<{ lat: number; lng: number; callback: (address: string) => void }> = [];

const roundCoordinate = (value: number): number => {
  return Math.round(value * 10000) / 10000;
};

const getCacheKey = (lat: number, lng: number): string => {
  return `${roundCoordinate(lat)},${roundCoordinate(lng)}`;
};

const processQueue = async (): Promise<void> => {
  if (isProcessing || queue.length === 0) {
    return;
  }

  isProcessing = true;

  while (queue.length > 0) {
    const { lat, lng, callback } = queue.shift()!;
    const cacheKey = getCacheKey(lat, lng);

    try {
      const response = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
      if (!response.ok) {
        throw new Error(`Geocode request failed: ${response.statusText}`);
      }

      const data = await response.json();
      const address = data.address || '';

      cache.set(cacheKey, address);
      callback(address);
    } catch (error) {
      console.error('Geocoding error:', error);
      callback('');
    }

    if (queue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  isProcessing = false;
};

export const queueGeocode = (
  lat: number,
  lng: number,
  callback: (address: string) => void
): void => {
  const cacheKey = getCacheKey(lat, lng);

  if (cache.has(cacheKey)) {
    callback(cache.get(cacheKey)!);
    return;
  }

  queue.push({ lat, lng, callback });
  processQueue();
};

export const getCachedAddress = (lat: number, lng: number): string | null => {
  const cacheKey = getCacheKey(lat, lng);
  return cache.get(cacheKey) ?? null;
};
