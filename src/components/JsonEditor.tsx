import { useMemo } from 'react';
import { JsonEditor as JsonEditorLib, githubDarkTheme } from 'json-edit-react';
import type { ThemeStyles } from 'json-edit-react';

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  rootName?: string;
}

const muiDarkOverrides: Partial<ThemeStyles> = {
  container: {
    backgroundColor: 'transparent',
    padding: '8px 0',
    fontFamily: '"Geist Mono", monospace',
    fontSize: '13px',
  },
  collection: {
    backgroundColor: 'transparent',
  },
  collectionInner: {
    backgroundColor: 'transparent',
  },
  property: {
    color: '#E2E2E9',
  },
  bracket: {
    color: '#8E9099',
  },
  itemCount: {
    color: '#8E9099',
    fontStyle: 'italic',
  },
  string: {
    color: '#6DD58C',
  },
  number: {
    color: '#A8C7FA',
  },
  boolean: {
    color: '#D2A8FF',
  },
  null: {
    color: '#8E9099',
    fontStyle: 'italic',
  },
  input: {
    backgroundColor: '#282C34',
    color: '#E2E2E9',
    borderRadius: '4px',
    padding: '2px 6px',
    fontFamily: '"Geist Mono", monospace',
    fontSize: '13px',
  },
  inputHighlight: {
    color: '#A8C7FA',
  },
  error: {
    color: '#FFB4AB',
  },
  iconCollection: {
    color: '#A8C7FA',
  },
  iconEdit: {
    color: '#C5C6D0',
  },
  iconDelete: {
    color: '#FFB4AB',
  },
  iconAdd: {
    color: '#6DD58C',
  },
  iconCopy: {
    color: '#C5C6D0',
  },
  iconOk: {
    color: '#6DD58C',
  },
  iconCancel: {
    color: '#FFB4AB',
  },
};

export default function JsonEditor({ value, onChange, readOnly, rootName }: JsonEditorProps) {
  const parsed = useMemo(() => {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }, [value]);

  if (parsed === null) {
    return (
      <div style={{ color: '#FFB4AB', fontFamily: '"Geist Mono", monospace', fontSize: 13, padding: 16 }}>
        Invalid JSON — switch to Text mode to fix syntax errors.
      </div>
    );
  }

  return (
    <JsonEditorLib
      data={parsed}
      setData={(data) => onChange(JSON.stringify(data, null, 2))}
      rootName={rootName}
      viewOnly={readOnly}
      theme={[githubDarkTheme, muiDarkOverrides]}
      collapse={2}
      indent={2}
      showArrayIndices
      showStringQuotes
      enableClipboard
      showCollectionCount="when-closed"
    />
  );
}
