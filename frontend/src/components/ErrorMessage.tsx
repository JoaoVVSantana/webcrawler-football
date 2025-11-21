interface ErrorMessageProps {
  message: string;
}

export function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <div className="error-message">
      <div className="error-content">
        <span className="error-icon">🚨</span>
        <p>{message}</p>
      </div>
    </div>
  );
}
