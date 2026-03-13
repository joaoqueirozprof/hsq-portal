interface LoadingProps {
  message?: string;
  fullScreen?: boolean;
}

export default function Loading({ message = 'Carregando...', fullScreen = false }: LoadingProps) {
  if (fullScreen) {
    return (
      <div className="loading-overlay">
        <div className="loading-ring" />
        <div className="loading-text">{message}</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div className="loading-ring" />
      <div className="loading-text">{message}</div>
    </div>
  );
}
