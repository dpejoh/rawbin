import 'react';

type CustomElement<T = HTMLElement> = React.DetailedHTMLProps<React.HTMLAttributes<T>, T>;

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'mdui-layout':                  CustomElement;
      'mdui-layout-main':             CustomElement;
      'mdui-navigation-rail':         CustomElement & { value?: string; 'label-visibility'?: string };
      'mdui-navigation-rail-item':    CustomElement & { value?: string; icon?: string; 'active-icon'?: string };
      'mdui-navigation-bar':          CustomElement & { value?: string; 'label-visibility'?: string };
      'mdui-navigation-bar-item':     CustomElement & { value?: string; icon?: string; 'active-icon'?: string };
      'mdui-button': CustomElement & {
        variant?: 'elevated' | 'filled' | 'tonal' | 'outlined' | 'text';
        icon?: string;
        'end-icon'?: string;
        href?: string;
        disabled?: boolean;
        loading?: boolean;
        'full-width'?: boolean;
      };
      'mdui-button-icon': CustomElement & { icon?: string; href?: string; disabled?: boolean };
      'mdui-card': CustomElement & { variant?: 'elevated' | 'filled' | 'outlined'; clickable?: boolean };
      'mdui-text-field': CustomElement & {
        variant?: 'outlined' | 'filled';
        label?: string;
        placeholder?: string;
        rows?: number;
        'min-rows'?: number;
        'max-rows'?: number;
        multiline?: boolean;
        type?: string;
        disabled?: boolean;
        readonly?: boolean;
        clearable?: boolean;
        helper?: string;
      };
      'mdui-dialog': CustomElement & {
        headline?: string;
        'close-on-overlay-click'?: boolean;
        'close-on-esc'?: boolean;
        icon?: string;
      };
      'mdui-list':      CustomElement;
      'mdui-list-item': CustomElement & {
        value?: string;
        icon?: string;
        'active-icon'?: string;
        rounded?: boolean;
        disabled?: boolean;
        nonclickable?: boolean;
        href?: string;
      };
      'mdui-divider':   CustomElement & { inset?: boolean; middle?: boolean };
      'mdui-chip': CustomElement & {
        variant?: 'assist' | 'filter' | 'input' | 'suggestion';
        icon?: string;
        selectable?: boolean;
        selected?: boolean;
        elevated?: boolean;
        disabled?: boolean;
      };
      'mdui-switch':              CustomElement & { checked?: boolean; disabled?: boolean };
      'mdui-circular-progress':   CustomElement & { value?: number };
      'mdui-linear-progress':     CustomElement & { value?: number };
      'mdui-icon':                CustomElement & { name?: string };
      'mdui-avatar':              CustomElement & { src?: string; label?: string };
      'mdui-skeleton':            CustomElement;
      'mdui-tooltip':             CustomElement & { content?: string; placement?: string };
      'mdui-dropdown': CustomElement & {
        trigger?: string;
        placement?: string;
        disabled?: boolean;
        open?: boolean;
      };
      'mdui-menu':      CustomElement & { selects?: string; value?: string };
      'mdui-menu-item': CustomElement & {
        value?: string;
        icon?: string;
        'active-icon'?: string;
        disabled?: boolean;
        href?: string;
      };
      'mdui-breadcrumb':      CustomElement;
      'mdui-breadcrumb-item': CustomElement & { href?: string; separator?: string };
    }
  }
}
