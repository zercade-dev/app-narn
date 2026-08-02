import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover.js';
import { isValidHexColor } from '../../lib/color-text.js';
import { useColorTextStore } from '../../stores/color-text-store.js';
import { BUILTIN_GROUPS } from './palettes.js';

interface SwatchChipProps {
  hex: string;
  label: string;
  testId: string;
  onApply: (hex: string) => void;
  /** Present only on user-owned colors; built-ins are read-only. */
  onDelete?: () => void;
  deleteLabel?: string;
}

function SwatchChip({ hex, label, testId, onApply, onDelete, deleteLabel }: SwatchChipProps) {
  return (
    <span className="group/swatch relative inline-flex">
      <button
        type="button"
        data-testid={testId}
        title={hex}
        // Keep the editor's text selection alive: focus must not move on click.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onApply(hex)}
        className="flex h-7 items-center gap-1.5 rounded-md border border-border bg-card px-2 text-xs transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <span
          aria-hidden
          className="size-3 shrink-0 rounded-full border border-black/20 dark:border-white/20"
          style={{ backgroundColor: hex }}
        />
        <span className="max-w-24 truncate">{label}</span>
      </button>
      {onDelete && (
        <button
          type="button"
          aria-label={deleteLabel}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onDelete}
          className="absolute -top-1.5 -right-1.5 hidden size-4 items-center justify-center rounded-full border border-border bg-background text-muted-foreground group-hover/swatch:flex group-focus-within/swatch:flex hover:text-destructive"
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}

/** Built-in palette groups (read-only) + the user's "My colors" group. */
export function PaletteSection({ onApply }: { onApply: (hex: string) => void }) {
  const { t } = useTranslation('colorText');
  const customColors = useColorTextStore((s) => s.customColors);
  const addColor = useColorTextStore((s) => s.addColor);
  const removeColor = useColorTextStore((s) => s.removeColor);
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState('#FF8800');
  const [name, setName] = useState('');
  const hexValid = isValidHexColor(hex);

  const handleAdd = () => {
    if (!hexValid) return;
    addColor(name, hex);
    setName('');
    setOpen(false);
  };

  return (
    <section className="space-y-2" data-testid="color-text-palette">
      {BUILTIN_GROUPS.map((group) => (
        <div key={group.id} className="flex flex-wrap items-center gap-1.5">
          <span className="w-28 shrink-0 text-xs font-medium text-muted-foreground">
            {t(group.labelKey)}
          </span>
          {group.swatches.map((s) => (
            <SwatchChip
              key={s.key}
              hex={s.hex}
              label={t(`swatches.${s.key}`)}
              testId={`color-text-swatch-${group.id}-${s.key}`}
              onApply={onApply}
            />
          ))}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-28 shrink-0 text-xs font-medium text-muted-foreground">
          {t('groupCustom')}
        </span>
        {customColors.map((c) => (
          <SwatchChip
            key={c.id}
            hex={c.hex}
            label={c.name || c.hex}
            testId={`color-text-swatch-custom-${c.id}`}
            onApply={onApply}
            onDelete={() => removeColor(c.id)}
            deleteLabel={t('deleteColor', { name: c.name || c.hex })}
          />
        ))}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            data-testid="color-text-add-color"
            className="flex h-7 items-center gap-1 rounded-md border border-dashed border-border px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Plus className="size-3" />
            {t('addColor')}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 space-y-2">
            <div className="flex items-end gap-2">
              <input
                type="color"
                aria-label={t('colorHexLabel')}
                // The native picker only speaks 6-digit hex; 3/8-digit values
                // still flow through the text input beside it.
                value={hexValid && hex.length === 7 ? hex : '#FF8800'}
                onChange={(e) => setHex(e.target.value.toUpperCase())}
                className="size-8 shrink-0 cursor-pointer rounded border border-border bg-transparent p-0.5"
              />
              <div className="flex-1 space-y-1">
                <Label htmlFor="color-text-hex-input" className="text-xs">
                  {t('colorHexLabel')}
                </Label>
                <Input
                  id="color-text-hex-input"
                  data-testid="color-text-hex-input"
                  value={hex}
                  onChange={(e) => setHex(e.target.value.trim().toUpperCase())}
                  className="h-7 font-mono text-xs"
                />
              </div>
            </div>
            {!hexValid && <p className="text-xs text-destructive">{t('invalidHex')}</p>}
            <div className="space-y-1">
              <Label htmlFor="color-text-name-input" className="text-xs">
                {t('colorNameLabel')}
              </Label>
              <Input
                id="color-text-name-input"
                data-testid="color-text-name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <Button
              size="sm"
              disabled={!hexValid}
              onClick={handleAdd}
              data-testid="color-text-add-color-confirm"
            >
              {t('addColorConfirm')}
            </Button>
          </PopoverContent>
        </Popover>
      </div>
    </section>
  );
}
