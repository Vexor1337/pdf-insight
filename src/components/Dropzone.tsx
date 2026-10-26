import { useId, useState, type ChangeEvent, type DragEvent } from 'react';
import { MAX_FILE_BYTES } from '../../shared/limits.ts';

interface DropzoneProps {
  disabled: boolean;
  onFiles: (files: readonly File[]) => void;
}

const MAX_MB = MAX_FILE_BYTES / (1024 * 1024);

export function Dropzone({ disabled, onFiles }: DropzoneProps) {
  const inputId = useId();
  const hintId = useId();
  const [isDragging, setDragging] = useState(false);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!disabled) setDragging(true);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!disabled) onFiles(Array.from(event.dataTransfer.files));
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className={`dropzone${isDragging ? ' dropzone--active' : ''}${disabled ? ' dropzone--disabled' : ''}`}
      data-testid="dropzone"
      onDragOver={handleDragOver}
      onDragLeave={() => {
        setDragging(false);
      }}
      onDrop={handleDrop}
    >
      <input
        id={inputId}
        className="visually-hidden"
        type="file"
        accept="application/pdf,.pdf"
        disabled={disabled}
        aria-describedby={hintId}
        onChange={handleChange}
      />
      <label htmlFor={inputId} className="dropzone__label">
        <svg className="dropzone__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
        </svg>
        <span className="dropzone__title">
          {isDragging ? 'Upuść plik tutaj' : 'Przeciągnij PDF tutaj lub kliknij, aby wybrać'}
        </span>
        <span id={hintId} className="dropzone__hint">
          Jeden plik PDF, maksymalnie {MAX_MB} MB.
        </span>
      </label>
    </div>
  );
}
