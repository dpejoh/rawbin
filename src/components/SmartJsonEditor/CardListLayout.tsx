import { useCallback, useState } from "react";
import { Plus, GripVertical, ChevronDown, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { FieldSchema } from './types';
import FormLayout from './FormLayout';

interface CardListLayoutProps {
  data: Record<string, unknown>[];
  fields: FieldSchema[];
  onChange: (data: Record<string, unknown>[]) => void;
}

interface SortableCardProps {
  item: Record<string, unknown>;
  fields: FieldSchema[];
  index: number;
  onUpdate: (index: number, value: Record<string, unknown>) => void;
  onDelete: (index: number) => void;
}

function cardTitle(item: Record<string, unknown>, fields: FieldSchema[]): string {
  for (const key of ['id', 'name', 'label', 'title']) {
    const v = item[key];
    if (typeof v === 'string' && v) return v;
  }
  const firstStr = fields.find((f) => {
    const v = item[f.key];
    return typeof v === 'string' && v && f.type !== 'url' && f.type !== 'textarea';
  });
  if (firstStr) return String(item[firstStr.key]);
  return `Item ${fields.length > 0 ? JSON.stringify(item).slice(0, 40) : ''}`;
}

function cardType(item: Record<string, unknown>): string | null {
  const t = item.type;
  return typeof t === 'string' && t ? t : null;
}

function enabledValue(item: Record<string, unknown>): number | null {
  const e = item.enabled;
  if (typeof e === 'number') return e;
  if (typeof e === 'boolean') return e ? 1 : 0;
  return null;
}

function SortableCard({ item, fields, index, onUpdate, onDelete }: SortableCardProps) {
  const [expanded, setExpanded] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `card-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const type = cardType(item);
  const enabled = enabledValue(item);
  const title = cardTitle(item, fields);

  const nonTitleFields = fields.filter(
    (f) => f.key !== 'type' && f.key !== 'enabled'
  );

  const enabledColors: Record<number, string> = {
    0: 'text-red-400 bg-red-400/10',
    1: 'text-green-400 bg-green-400/10',
    2: 'text-yellow-400 bg-yellow-400/10',
  };

  const enabledLabels: Record<number, string> = {
    0: 'Off',
    1: 'On',
    2: '?',
  };

  return (
    <div ref={setNodeRef} style={style} className="border rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
      <div className="flex items-center gap-1 px-3 py-1.5">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none p-0.5"
        >
          <GripVertical className="size-4" />
        </button>

        {type && (
          <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded leading-none ${
            type === 'apk' ? 'text-green-400 bg-green-400/15' : 'text-primary bg-primary/15'
          }`}>
            {type}
          </span>
        )}

        <span className="flex-1 font-mono text-xs font-medium truncate">
          {title}
        </span>

        {enabled !== null && (
          <span className={`font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded min-w-[28px] text-center ${enabledColors[enabled] ?? 'text-muted-foreground bg-muted'}`}>
            {enabledLabels[enabled] ?? String(enabled)}
          </span>
        )}

        <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground p-0.5">
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>

        <button onClick={() => onDelete(index)} className="text-destructive hover:text-destructive/80 p-0.5">
          <X className="size-4" />
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t">
          <FormLayout
            data={item}
            fields={nonTitleFields.length > 0 ? nonTitleFields : fields.filter((f) => f.key !== 'type' && f.key !== 'enabled')}
            onChange={(updated) => onUpdate(index, updated)}
          />
        </div>
      )}
    </div>
  );
}

export default function CardListLayout({ data, fields, onChange }: CardListLayoutProps) {
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);

  const typeField = fields.find((f) => f.key === 'type');
  const typeOptions = typeField?.enumValues ?? ['item'];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIdx = parseInt(String(active.id).replace('card-', ''), 10);
      const newIdx = parseInt(String(over.id).replace('card-', ''), 10);
      onChange(arrayMove(data, oldIdx, newIdx));
    },
    [data, onChange]
  );

  const handleUpdate = useCallback(
    (index: number, value: Record<string, unknown>) => {
      const next = [...data];
      next[index] = value;
      onChange(next);
    },
    [data, onChange]
  );

  const handleDelete = useCallback(
    (index: number) => {
      const next = data.filter((_, i) => i !== index);
      onChange(next);
    },
    [data, onChange]
  );

  const handleAdd = useCallback(
    (typeVal: string) => {
      const template: Record<string, unknown> = {};
      for (const f of fields) {
        if (f.key === 'type') {
          template[f.key] = typeVal;
        } else if (f.type === 'boolean' || f.type === 'triState') {
          template[f.key] = 0;
        } else if (f.type === 'number') {
          template[f.key] = 0;
        } else if (f.type === 'enum') {
          template[f.key] = f.enumValues?.[0] ?? '';
        } else {
          template[f.key] = '';
        }
      }
      onChange([...data, template]);
      setTypeMenuOpen(false);
    },
    [data, fields, onChange]
  );

  return (
    <div>
      <div className="flex justify-end mb-2">
        {typeOptions.length === 1 ? (
          <Button variant="outline" size="sm" onClick={() => handleAdd(typeOptions[0]!)}>
            <Plus className="size-3 mr-1" />
            Add entry
          </Button>
        ) : (
          <div className="relative">
            <Button variant="outline" size="sm" onClick={() => setTypeMenuOpen(!typeMenuOpen)}>
              <Plus className="size-3 mr-1" />
              Add entry
            </Button>
            {typeMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-popover border rounded-md shadow-md py-1 min-w-[120px]">
                {typeOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleAdd(opt)}
                    className="w-full text-left px-3 py-1.5 text-sm font-mono hover:bg-accent"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={data.map((_, i) => `card-${i}`)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-1.5">
            {data.map((item, i) => (
              <SortableCard
                key={`card-${i}`}
                item={item}
                fields={fields}
                index={i}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
