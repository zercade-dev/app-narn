import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ALargeSmall, Bold, Italic } from 'lucide-react';
import { Button, buttonVariants } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover.js';

type FormatKind = 'bold' | 'italic' | 'size';

/** Bold/Italic/Size formatting toolbar, wired into both Color Text editor modes. */
export function FormatToolbar({
  onFormat,
  onSizeOpenChange,
}: {
  onFormat: (kind: FormatKind, value?: string) => void;
  // Notifies the host when the Size popover opens/closes, so rich mode can
  // snapshot its live selection before focus moves into the popover's input
  // (see ColorTextView's savedRichRangeRef).
  onSizeOpenChange?: (open: boolean) => void;
}) {
  const { t } = useTranslation('colorText');
  const [sizeOpen, setSizeOpen] = useState(false);
  const [size, setSize] = useState('24');

  const handleSizeOpenChange = (open: boolean) => {
    setSizeOpen(open);
    onSizeOpenChange?.(open);
  };

  const applySize = () => {
    onFormat('size', size);
    setSizeOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid="color-text-format-toolbar">
      <Button
        size="sm"
        variant="outline"
        // Keep the editor's selection alive: focus must not move on click.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onFormat('bold')}
        data-testid="color-text-format-bold"
      >
        <Bold className="size-3.5" />
        {t('formatBold')}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onFormat('italic')}
        data-testid="color-text-format-italic"
      >
        <Italic className="size-3.5" />
        {t('formatItalic')}
      </Button>
      <Popover open={sizeOpen} onOpenChange={handleSizeOpenChange}>
        <PopoverTrigger
          data-testid="color-text-format-size"
          onMouseDown={(e) => e.preventDefault()}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <ALargeSmall className="size-3.5" />
          {t('formatSize')}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-48 space-y-2">
          <div className="space-y-1">
            <Label htmlFor="color-text-size-input" className="text-xs">
              {t('sizeValueLabel')}
            </Label>
            <Input
              id="color-text-size-input"
              data-testid="color-text-size-input"
              type="number"
              min={8}
              max={200}
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="h-7 text-xs"
            />
          </div>
          <Button
            size="sm"
            onClick={applySize}
            disabled={size.trim() === ''}
            data-testid="color-text-format-size-confirm"
          >
            {t('applySize')}
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
