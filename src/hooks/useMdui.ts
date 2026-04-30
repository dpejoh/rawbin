import { useRef, useEffect, useCallback } from 'react';

type Ref<T = any> = React.RefObject<T>;

export function useMduiInput(
  value: string,
  onChange: (v: string) => void,
): Ref {
  const ref = useRef<any>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || el.value === value) return;
    el.value = value;
  }, [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => onChange(el.value ?? '');
    el.addEventListener('input', handler);
    return () => el.removeEventListener('input', handler);
  }, [onChange]);

  return ref;
}

export function useMduiDialog(open: boolean, onClose?: () => void): Ref {
  const ref = useRef<any>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.open = open;
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onClose) return;
    el.addEventListener('close', onClose);
    return () => el.removeEventListener('close', onClose);
  }, [onClose]);

  return ref;
}

export function useMduiSwitch(
  checked: boolean,
  onChange: (v: boolean) => void,
): Ref {
  const ref = useRef<any>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.checked = checked;
  }, [checked]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => onChange(Boolean(el.checked));
    el.addEventListener('change', handler);
    return () => el.removeEventListener('change', handler);
  }, [onChange]);

  return ref;
}

export function useMduiNav(
  value: string,
  onChange: (v: string) => void,
): Ref {
  const ref = useRef<any>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.value = value;
  }, [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      onChange(detail?.value ?? el.value ?? '');
    };
    el.addEventListener('change', handler);
    return () => el.removeEventListener('change', handler);
  }, [onChange]);

  return ref;
}

export function useMduiProps(props: Record<string, unknown>): Ref {
  const ref = useRef<any>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    for (const [k, v] of Object.entries(props)) el[k] = v;
  }, [props]);
  return ref;
}
