/**
 * Composant de barre de progression
 */

type ProgressBarProps = {
  progress: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  className?: string;
  color?: 'yellow' | 'teal' | 'green';
};

const colorClasses = {
  yellow: 'bg-brand-yellow',
  teal: 'bg-brand-teal',
  green: 'bg-green-500',
};

export default function ProgressBar({
  progress,
  label,
  showPercentage = false,
  className = '',
  color = 'yellow',
}: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          {showPercentage && (
            <span className="text-sm text-gray-600">{Math.round(clampedProgress)}%</span>
          )}
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
        <div
          className={`${colorClasses[color]} h-2.5 rounded-full transition-all duration-300 ease-out`}
          style={{ width: `${clampedProgress}%` }}
          role="progressbar"
          aria-valuenow={clampedProgress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label || 'Progression'}
        />
      </div>
    </div>
  );
}

