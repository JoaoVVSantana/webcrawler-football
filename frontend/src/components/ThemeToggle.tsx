interface ThemeToggleProps {
  theme: 'light' | 'dark';
  onToggle: () => void;
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  return (
    <button type="button" className="theme-toggle" onClick={onToggle} aria-label="Alternar tema">
      <span className="theme-icon">{theme === 'dark' ? '🌙' : '☀️'}</span>
      <span>{theme === 'dark' ? 'Escuro' : 'Claro'}</span>
    </button>
  );
}
