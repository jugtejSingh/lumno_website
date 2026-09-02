/* @ds-bundle: {"format":4,"namespace":"LumnoDesignSystem_956520","components":[{"name":"Avatar","sourcePath":"components/data-display/Avatar.jsx"},{"name":"Card","sourcePath":"components/data-display/Card.jsx"},{"name":"StatCard","sourcePath":"components/data-display/StatCard.jsx"},{"name":"Badge","sourcePath":"components/feedback/Badge.jsx"},{"name":"Dialog","sourcePath":"components/feedback/Dialog.jsx"},{"name":"Tag","sourcePath":"components/feedback/Tag.jsx"},{"name":"Toast","sourcePath":"components/feedback/Toast.jsx"},{"name":"Tooltip","sourcePath":"components/feedback/Tooltip.jsx"},{"name":"Button","sourcePath":"components/forms/Button.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"IconButton","sourcePath":"components/forms/IconButton.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Radio","sourcePath":"components/forms/Radio.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"Textarea","sourcePath":"components/forms/Textarea.jsx"},{"name":"SidebarNavItem","sourcePath":"components/navigation/SidebarNavItem.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"},{"name":"TopBar","sourcePath":"components/navigation/TopBar.jsx"}],"sourceHashes":{"components/data-display/Avatar.jsx":"0cfba30b7875","components/data-display/Card.jsx":"792f1dbd00db","components/data-display/StatCard.jsx":"8e9c4367460c","components/feedback/Badge.jsx":"3dc396024ad9","components/feedback/Dialog.jsx":"9a420b85f98a","components/feedback/Tag.jsx":"4e5fc86464e2","components/feedback/Toast.jsx":"2f171f0249e7","components/feedback/Tooltip.jsx":"468d03e7e27a","components/forms/Button.jsx":"06a112db005d","components/forms/Checkbox.jsx":"b25820299d1a","components/forms/IconButton.jsx":"ff2c557f7dc2","components/forms/Input.jsx":"7e7a4ac60018","components/forms/Radio.jsx":"d138d8e4cf4c","components/forms/Select.jsx":"d64f4e0c0298","components/forms/Switch.jsx":"3a2a0a53b5b8","components/forms/Textarea.jsx":"ae826cb6e661","components/navigation/SidebarNavItem.jsx":"2475ba5bf7c4","components/navigation/Tabs.jsx":"6281943bbad7","components/navigation/TopBar.jsx":"ed9493575fda","ui_kits/lumno-admin/App.jsx":"18ca522cd00b","ui_kits/lumno-admin/ClientsScreen.jsx":"9e48b1251ad0","ui_kits/lumno-admin/DashboardScreen.jsx":"be424e59759a","ui_kits/lumno-admin/MessagesScreen.jsx":"d12f9a574242","ui_kits/lumno-admin/NotesScreen.jsx":"bd820eb9af4d","ui_kits/lumno-admin/PaymentsScreen.jsx":"077575bdbd8f","ui_kits/lumno-admin/ScheduleScreen.jsx":"52d2fec2efe2","ui_kits/lumno-admin/SettingsScreen.jsx":"e055c105f516","ui_kits/lumno-admin/data.js":"f04575f51d7e","ui_kits/lumno-marketing/Home.jsx":"6b0690660eba","ui_kits/lumno-marketing/Login.jsx":"66602efb8321","ui_kits/lumno-marketing/Pricing.jsx":"a5ac6700adb4","ui_kits/lumno-marketing/Register.jsx":"6c9a8112df3d","ui_kits/lumno-marketing/shared.jsx":"69f76ec1dc14"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.LumnoDesignSystem_956520 = window.LumnoDesignSystem_956520 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/data-display/Avatar.jsx
try { (() => {
const palette = ['var(--plum-400)', 'var(--coral-400)', 'var(--sage-400)', 'var(--citrus-500)'];
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}
function Avatar({
  name,
  size = 36
}) {
  const initials = name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  const bg = palette[hash(name) % palette.length];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: '50%',
      background: bg,
      color: 'var(--beige-0)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-body)',
      fontWeight: 700,
      fontSize: size * 0.38,
      flexShrink: 0
    }
  }, initials);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Card.jsx
try { (() => {
function Card({
  children,
  padding = 'var(--space-4)',
  interactive
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      padding,
      boxShadow: hover && interactive ? 'var(--shadow-sm)' : 'var(--shadow-xs)',
      fontFamily: 'var(--font-body)',
      transition: 'box-shadow var(--duration-base) var(--ease-out)'
    }
  }, children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Card.jsx", error: String((e && e.message) || e) }); }

// components/data-display/StatCard.jsx
try { (() => {
function StatCard({
  label,
  value,
  delta,
  accent = 'plum'
}) {
  const colors = {
    plum: 'var(--plum-500)',
    coral: 'var(--coral-500)',
    sage: 'var(--sage-500)',
    citrus: 'var(--citrus-600)'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-4)',
      boxShadow: 'var(--shadow-xs)',
      fontFamily: 'var(--font-body)',
      minWidth: 150
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--text-muted)',
      fontWeight: 600
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 36,
      color: colors[accent],
      marginTop: 4
    }
  }, value), delta && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--text-secondary)',
      marginTop: 2
    }
  }, delta));
}
Object.assign(__ds_scope, { StatCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/StatCard.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Badge.jsx
try { (() => {
const tones = {
  neutral: {
    bg: 'var(--beige-200)',
    fg: 'var(--beige-700)'
  },
  plum: {
    bg: 'var(--plum-300)',
    fg: 'var(--plum-700)'
  },
  success: {
    bg: 'var(--success-bg)',
    fg: 'var(--success)'
  },
  warning: {
    bg: 'var(--warning-bg)',
    fg: 'var(--warning)'
  },
  danger: {
    bg: 'var(--danger-bg)',
    fg: 'var(--danger)'
  }
};
function Badge({
  tone = 'neutral',
  children
}) {
  const t = tones[tone];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '3px 10px',
      borderRadius: 'var(--radius-pill)',
      background: t.bg,
      color: t.fg,
      fontFamily: 'var(--font-body)',
      fontSize: '12px',
      fontWeight: 700,
      letterSpacing: 'var(--ls-wide)',
      textTransform: 'uppercase'
    }
  }, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Badge.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Dialog.jsx
try { (() => {
function Dialog({
  open,
  title,
  children,
  onClose,
  footer
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      background: 'oklch(20% 0.02 50 / 0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      background: 'var(--surface-card)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-lg)',
      padding: 'var(--space-6)',
      width: 420,
      maxWidth: '90vw',
      fontFamily: 'var(--font-body)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 24,
      marginBottom: 12,
      color: 'var(--text-primary)'
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text-secondary)',
      fontSize: 14,
      lineHeight: 'var(--lh-relaxed)'
    }
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 10,
      marginTop: 20
    }
  }, footer)));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tag.jsx
try { (() => {
const colors = {
  plum: 'var(--plum-400)',
  coral: 'var(--coral-400)',
  sage: 'var(--sage-400)',
  citrus: 'var(--citrus-600)',
  neutral: 'var(--beige-600)'
};
function Tag({
  color = 'neutral',
  children,
  onRemove
}) {
  const c = colors[color];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 10px 4px 12px',
      borderRadius: 'var(--radius-pill)',
      border: `1px solid ${c}`,
      color: c,
      fontFamily: 'var(--font-body)',
      fontSize: '13px',
      fontWeight: 600
    }
  }, children, onRemove && /*#__PURE__*/React.createElement("span", {
    onClick: onRemove,
    style: {
      cursor: 'pointer',
      fontSize: 12
    }
  }, "\u2715"));
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tag.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
const tones = {
  success: 'var(--success)',
  danger: 'var(--danger)',
  info: 'var(--info)',
  neutral: 'var(--beige-800)'
};
function Toast({
  tone = 'info',
  title,
  description,
  onClose
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
      background: 'var(--beige-900)',
      color: 'var(--text-inverse)',
      borderRadius: 'var(--radius-md)',
      padding: '14px 16px',
      boxShadow: 'var(--shadow-lg)',
      fontFamily: 'var(--font-body)',
      maxWidth: 340
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: tones[tone],
      marginTop: 6,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 14
    }
  }, title), description && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--beige-400)',
      marginTop: 2
    }
  }, description)), onClose && /*#__PURE__*/React.createElement("span", {
    onClick: onClose,
    style: {
      cursor: 'pointer',
      color: 'var(--beige-500)'
    }
  }, "\u2715"));
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tooltip.jsx
try { (() => {
function Tooltip({
  label,
  children
}) {
  const [show, setShow] = React.useState(false);
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      display: 'inline-block'
    },
    onMouseEnter: () => setShow(true),
    onMouseLeave: () => setShow(false)
  }, children, show && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      bottom: '125%',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'var(--beige-900)',
      color: 'var(--text-inverse)',
      fontFamily: 'var(--font-body)',
      fontSize: 12,
      padding: '5px 9px',
      borderRadius: 'var(--radius-xs)',
      whiteSpace: 'nowrap',
      boxShadow: 'var(--shadow-sm)',
      zIndex: 10
    }
  }, label));
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/forms/Button.jsx
try { (() => {
const sizePad = {
  sm: '6px 12px',
  md: '10px 18px',
  lg: '13px 22px'
};
const sizeFont = {
  sm: '13px',
  md: '14px',
  lg: '16px'
};
function Button({
  variant = 'primary',
  size = 'md',
  icon,
  disabled,
  children,
  onClick
}) {
  const base = {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    borderRadius: 'var(--radius-sm)',
    padding: sizePad[size],
    fontSize: sizeFont[size],
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'background var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--ease-out)',
    opacity: disabled ? 0.5 : 1
  };
  const variants = {
    primary: {
      background: 'var(--accent-primary)',
      color: 'var(--text-on-accent)'
    },
    pop: {
      background: 'var(--accent-pop)',
      color: 'var(--text-on-accent)'
    },
    secondary: {
      background: 'var(--surface-card)',
      color: 'var(--text-primary)',
      border: '1px solid var(--border-subtle)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-primary)'
    },
    danger: {
      background: 'var(--danger)',
      color: 'var(--text-on-accent)'
    }
  };
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const hoverBg = {
    primary: 'var(--accent-primary-hover)',
    pop: 'var(--accent-pop-hover)',
    secondary: 'var(--beige-200)',
    ghost: 'var(--beige-200)',
    danger: 'var(--danger)'
  };
  const pressBg = {
    primary: 'var(--accent-primary-press)',
    pop: 'var(--accent-pop-hover)',
    secondary: 'var(--beige-300)',
    ghost: 'var(--beige-300)',
    danger: 'var(--danger)'
  };
  const style = {
    ...base,
    ...variants[variant]
  };
  if (!disabled && press) style.background = pressBg[variant];else if (!disabled && hover) style.background = hoverBg[variant];
  if (!disabled && press) style.transform = 'translateY(1px)';
  return /*#__PURE__*/React.createElement("button", {
    style: style,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setPress(false);
    },
    onMouseDown: () => setPress(true),
    onMouseUp: () => setPress(false)
  }, icon, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Button.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function Checkbox({
  label,
  checked,
  onChange
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      fontFamily: 'var(--font-body)',
      fontSize: '14px',
      color: 'var(--text-primary)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    onClick: () => onChange && onChange(!checked),
    style: {
      width: 18,
      height: 18,
      borderRadius: '5px',
      border: `1.5px solid ${checked ? 'var(--accent-primary)' : 'var(--border-strong)'}`,
      background: checked ? 'var(--accent-primary)' : 'var(--surface-card)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background var(--duration-fast) var(--ease-out)'
    }
  }, checked && /*#__PURE__*/React.createElement("svg", {
    width: "11",
    height: "11",
    viewBox: "0 0 24 24",
    fill: "none"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M20 6L9 17l-5-5",
    stroke: "var(--beige-0)",
    strokeWidth: "3",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }))), label);
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/IconButton.jsx
try { (() => {
function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 20,
  onClick
}) {
  const [hover, setHover] = React.useState(false);
  const bg = variant === 'ghost' ? hover ? 'var(--beige-200)' : 'transparent' : hover ? 'var(--accent-primary-hover)' : 'var(--accent-primary)';
  const color = variant === 'ghost' ? 'var(--text-primary)' : 'var(--text-on-accent)';
  return /*#__PURE__*/React.createElement("button", {
    "aria-label": label,
    title: label,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      width: size + 20,
      height: size + 20,
      borderRadius: 'var(--radius-sm)',
      border: 'none',
      background: bg,
      color,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'background var(--duration-fast) var(--ease-out)'
    }
  }, icon);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function Input({
  label,
  placeholder,
  type = 'text',
  value,
  onChange,
  error,
  helper
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-body)',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px'
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: '13px',
      fontWeight: 600,
      color: 'var(--text-secondary)'
    }
  }, label), /*#__PURE__*/React.createElement("input", {
    type: type,
    placeholder: placeholder,
    value: value,
    onChange: onChange,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: '14px',
      padding: '10px 12px',
      borderRadius: 'var(--radius-sm)',
      border: `1px solid ${error ? 'var(--danger)' : focus ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
      background: 'var(--surface-card)',
      color: 'var(--text-primary)',
      outline: 'none',
      boxShadow: focus ? 'var(--shadow-focus)' : 'none',
      transition: 'box-shadow var(--duration-fast) var(--ease-out)'
    }
  }), (error || helper) && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '12px',
      color: error ? 'var(--danger)' : 'var(--text-muted)'
    }
  }, error || helper));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Radio.jsx
try { (() => {
function Radio({
  label,
  checked,
  onChange
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      fontFamily: 'var(--font-body)',
      fontSize: '14px',
      color: 'var(--text-primary)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    onClick: () => onChange && onChange(),
    style: {
      width: 18,
      height: 18,
      borderRadius: '50%',
      border: `1.5px solid ${checked ? 'var(--accent-primary)' : 'var(--border-strong)'}`,
      background: 'var(--surface-card)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, checked && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: '50%',
      background: 'var(--accent-primary)'
    }
  })), label);
}
Object.assign(__ds_scope, { Radio });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Radio.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function Select({
  label,
  options = [],
  value,
  onChange
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-body)',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px'
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: '13px',
      fontWeight: 600,
      color: 'var(--text-secondary)'
    }
  }, label), /*#__PURE__*/React.createElement("select", {
    value: value,
    onChange: onChange,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: '14px',
      padding: '10px 12px',
      borderRadius: 'var(--radius-sm)',
      border: `1px solid ${focus ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
      background: 'var(--surface-card)',
      color: 'var(--text-primary)',
      outline: 'none',
      boxShadow: focus ? 'var(--shadow-focus)' : 'none'
    }
  }, options.map(o => /*#__PURE__*/React.createElement("option", {
    key: o,
    value: o
  }, o))));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function Switch({
  checked,
  onChange,
  label
}) {
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '10px',
      fontFamily: 'var(--font-body)',
      fontSize: '14px',
      color: 'var(--text-primary)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    onClick: () => onChange && onChange(!checked),
    style: {
      width: 38,
      height: 22,
      borderRadius: 'var(--radius-pill)',
      background: checked ? 'var(--accent-primary)' : 'var(--beige-400)',
      position: 'relative',
      transition: 'background var(--duration-base) var(--ease-out)',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 2,
      left: checked ? 18 : 2,
      width: 18,
      height: 18,
      borderRadius: '50%',
      background: 'var(--beige-0)',
      transition: 'left var(--duration-base) var(--ease-out)',
      boxShadow: 'var(--shadow-xs)'
    }
  })), label);
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/forms/Textarea.jsx
try { (() => {
function Textarea({
  label,
  placeholder,
  value,
  onChange,
  rows = 4,
  helper
}) {
  const [focus, setFocus] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-body)',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px'
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: '13px',
      fontWeight: 600,
      color: 'var(--text-secondary)'
    }
  }, label), /*#__PURE__*/React.createElement("textarea", {
    placeholder: placeholder,
    value: value,
    onChange: onChange,
    rows: rows,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: '14px',
      padding: '10px 12px',
      borderRadius: 'var(--radius-sm)',
      border: `1px solid ${focus ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
      resize: 'vertical',
      background: 'var(--surface-card)',
      color: 'var(--text-primary)',
      outline: 'none',
      boxShadow: focus ? 'var(--shadow-focus)' : 'none',
      transition: 'box-shadow var(--duration-fast) var(--ease-out)'
    }
  }), helper && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '12px',
      color: 'var(--text-muted)'
    }
  }, helper));
}
Object.assign(__ds_scope, { Textarea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Textarea.jsx", error: String((e && e.message) || e) }); }

// components/navigation/SidebarNavItem.jsx
try { (() => {
function SidebarNavItem({
  icon,
  label,
  active,
  badge,
  onClick
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '9px 12px',
      borderRadius: 'var(--radius-sm)',
      background: active ? 'var(--beige-900)' : hover ? 'var(--beige-200)' : 'transparent',
      color: active ? 'var(--beige-50)' : 'var(--text-primary)',
      cursor: 'pointer',
      fontFamily: 'var(--font-body)',
      fontSize: 14,
      fontWeight: 600,
      transition: 'background var(--duration-fast) var(--ease-out)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      width: 18
    }
  }, icon), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, label), badge && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      background: active ? 'var(--coral-500)' : 'var(--accent-pop)',
      color: 'var(--beige-0)',
      borderRadius: 'var(--radius-pill)',
      padding: '1px 7px'
    }
  }, badge));
}
Object.assign(__ds_scope, { SidebarNavItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/SidebarNavItem.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function Tabs({
  tabs = [],
  active,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      borderBottom: '1px solid var(--border-subtle)',
      fontFamily: 'var(--font-body)'
    }
  }, tabs.map(t => /*#__PURE__*/React.createElement("div", {
    key: t,
    onClick: () => onChange && onChange(t),
    style: {
      padding: '10px 16px',
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer',
      color: active === t ? 'var(--accent-primary)' : 'var(--text-muted)',
      borderBottom: active === t ? '2px solid var(--accent-primary)' : '2px solid transparent',
      marginBottom: -1
    }
  }, t)));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TopBar.jsx
try { (() => {
function TopBar({
  title,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 24px',
      borderBottom: '1px solid var(--border-subtle)',
      background: 'oklch(97.5% 0.012 85 / 0.85)',
      backdropFilter: 'blur(8px)',
      fontFamily: 'var(--font-body)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 22,
      fontStyle: 'italic',
      color: 'var(--text-primary)'
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, children));
}
Object.assign(__ds_scope, { TopBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TopBar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/lumno-admin/App.jsx
try { (() => {
const {
  SidebarNavItem,
  TopBar,
  Avatar,
  Toast
} = window.LumnoDesignSystem_956520;
function Icon({
  name
}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (window.lucide) window.lucide.createIcons({
      nameAttr: 'data-lucide',
      attrs: {
        width: 18,
        height: 18
      }
    });
  });
  return /*#__PURE__*/React.createElement("i", {
    "data-lucide": name,
    ref: ref
  });
}
function App() {
  const [screen, setScreen] = React.useState('Dashboard');
  const [toast, setToast] = React.useState(false);
  const nav = [{
    label: 'Dashboard',
    icon: 'layout-dashboard'
  }, {
    label: 'Schedule',
    icon: 'calendar'
  }, {
    label: 'Clients',
    icon: 'users'
  }, {
    label: 'Notes',
    icon: 'file-text'
  }, {
    label: 'Payments',
    icon: 'credit-card'
  }, {
    label: 'Messages',
    icon: 'mail',
    badge: 2
  }, {
    label: 'Settings',
    icon: 'settings'
  }];
  const screens = {
    Dashboard: /*#__PURE__*/React.createElement(DashboardScreen, {
      clients: window.CLIENTS
    }),
    Clients: /*#__PURE__*/React.createElement(ClientsScreen, {
      clients: window.CLIENTS
    }),
    Schedule: /*#__PURE__*/React.createElement(ScheduleScreen, {
      clients: window.CLIENTS
    }),
    Notes: /*#__PURE__*/React.createElement(NotesScreen, null),
    Payments: /*#__PURE__*/React.createElement(PaymentsScreen, {
      clients: window.CLIENTS
    }),
    Messages: /*#__PURE__*/React.createElement(MessagesScreen, {
      messages: window.MESSAGES
    }),
    Settings: /*#__PURE__*/React.createElement(SettingsScreen, null)
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      height: '100vh',
      background: 'var(--surface-app)',
      fontFamily: 'var(--font-body)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 220,
      borderRight: '1px solid var(--border-subtle)',
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontStyle: 'italic',
      fontSize: 26,
      marginBottom: 18,
      paddingLeft: 4
    }
  }, "Lumno"), nav.map(n => /*#__PURE__*/React.createElement(SidebarNavItem, {
    key: n.label,
    label: n.label,
    icon: /*#__PURE__*/React.createElement(Icon, {
      name: n.icon
    }),
    active: screen === n.label,
    badge: n.badge,
    onClick: () => {
      setScreen(n.label);
      if (n.label === 'Dashboard') {
        setToast(true);
        setTimeout(() => setToast(false), 2200);
      }
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(TopBar, {
    title: screen
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search"
  }), /*#__PURE__*/React.createElement(Avatar, {
    name: "Dana Reyes",
    size: 30
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: 24,
      overflowY: 'auto'
    }
  }, screens[screen])), toast && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 50
    }
  }, /*#__PURE__*/React.createElement(Toast, {
    tone: "info",
    title: "Welcome back",
    description: "You have 4 sessions today."
  })));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/lumno-admin/App.jsx", error: String((e && e.message) || e) }); }

// ui_kits/lumno-admin/ClientsScreen.jsx
try { (() => {
const {
  Input,
  Select,
  Card,
  Avatar,
  Tag,
  Badge,
  Dialog,
  Tabs,
  Button,
  Textarea
} = window.LumnoDesignSystem_956520;
function ClientsScreen({
  clients
}) {
  const [query, setQuery] = React.useState('');
  const [selected, setSelected] = React.useState(null);
  const [tab, setTab] = React.useState('Overview');
  const filtered = clients.filter(c => c.name.toLowerCase().includes(query.toLowerCase()));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 32
    }
  }, "Clients"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(Input, {
    placeholder: "Search clients",
    value: query,
    onChange: e => setQuery(e.target.value)
  })), /*#__PURE__*/React.createElement(Select, {
    options: ['All statuses', 'Confirmed', 'Pending', 'Cancelled']
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "pop"
  }, "+ New client")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, filtered.map(c => /*#__PURE__*/React.createElement(Card, {
    key: c.id,
    interactive: true
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => {
      setSelected(c);
      setTab('Overview');
    },
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: c.name
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700
    }
  }, c.name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      marginTop: 4
    }
  }, c.tags.map(([color, label]) => /*#__PURE__*/React.createElement(Tag, {
    key: label,
    color: color
  }, label)))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--text-muted)',
      width: 140
    }
  }, c.next), /*#__PURE__*/React.createElement(Badge, {
    tone: c.status === 'confirmed' ? 'success' : c.status === 'pending' ? 'warning' : 'danger'
  }, c.status))))), /*#__PURE__*/React.createElement(Dialog, {
    open: !!selected,
    title: selected ? selected.name : '',
    onClose: () => setSelected(null),
    footer: /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      onClick: () => setSelected(null)
    }, "Close")
  }, selected && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Tabs, {
    tabs: ['Overview', 'Notes', 'Billing'],
    active: tab,
    onChange: setTab
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, tab === 'Overview' && /*#__PURE__*/React.createElement("div", null, "Next session: ", selected.next, ". Tags: ", selected.tags.map(t => t[1]).join(', '), "."), tab === 'Notes' && /*#__PURE__*/React.createElement(Textarea, {
    placeholder: "Write a session note...",
    rows: 4,
    helper: "Autosaves every 30 seconds"
  }), tab === 'Billing' && /*#__PURE__*/React.createElement("div", null, "No outstanding balance.")))));
}
window.ClientsScreen = ClientsScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/lumno-admin/ClientsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/lumno-admin/DashboardScreen.jsx
try { (() => {
const {
  StatCard,
  Card,
  Avatar,
  Badge,
  Button
} = window.LumnoDesignSystem_956520;
function DashboardScreen({
  clients
}) {
  const upcoming = clients.filter(c => c.status !== 'cancelled').slice(0, 4);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 40,
      color: 'var(--text-primary)'
    }
  }, "Good afternoon, Dana"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontStyle: 'italic',
      fontSize: 22,
      color: 'var(--accent-primary)',
      marginTop: 2
    }
  }, "You have 4 sessions today")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "Sessions this week",
    value: "12",
    delta: "+2 vs last week",
    accent: "plum"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "New clients",
    value: "3",
    accent: "coral"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Notes overdue",
    value: "1",
    accent: "citrus"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Unread messages",
    value: "2",
    accent: "sage"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18,
      fontWeight: 700,
      marginBottom: 10
    }
  }, "Upcoming sessions"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, upcoming.map(c => /*#__PURE__*/React.createElement(Card, {
    key: c.id,
    interactive: true
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: c.name
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700
    }
  }, c.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--text-muted)'
    }
  }, c.next)), /*#__PURE__*/React.createElement(Badge, {
    tone: c.status === 'confirmed' ? 'success' : 'warning'
  }, c.status), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "secondary"
  }, "Open")))))));
}
window.DashboardScreen = DashboardScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/lumno-admin/DashboardScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/lumno-admin/MessagesScreen.jsx
try { (() => {
const {
  Avatar,
  Textarea,
  Button
} = window.LumnoDesignSystem_956520;
function MessagesScreen({
  messages
}) {
  const [activeId, setActiveId] = React.useState(messages[0].id);
  const [draft, setDraft] = React.useState('');
  const active = messages.find(m => m.id === activeId);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      height: '100%',
      gap: 0,
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      background: 'var(--surface-card)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 240,
      borderRight: '1px solid var(--border-subtle)'
    }
  }, messages.map(m => /*#__PURE__*/React.createElement("div", {
    key: m.id,
    onClick: () => setActiveId(m.id),
    style: {
      display: 'flex',
      gap: 10,
      padding: 12,
      cursor: 'pointer',
      background: m.id === activeId ? 'var(--beige-200)' : 'transparent'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: m.name,
    size: 32
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 13
    }
  }, m.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--text-muted)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, m.preview)), m.unread > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      background: 'var(--accent-pop)',
      color: 'var(--beige-0)',
      borderRadius: 'var(--radius-pill)',
      fontSize: 11,
      padding: '1px 7px',
      height: 'fit-content'
    }
  }, m.unread)))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      overflowY: 'auto'
    }
  }, active.thread.map((t, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      alignSelf: t.from === 'me' ? 'flex-end' : 'flex-start',
      background: t.from === 'me' ? 'var(--accent-primary)' : 'var(--beige-200)',
      color: t.from === 'me' ? 'var(--text-on-accent)' : 'var(--text-primary)',
      padding: '8px 12px',
      borderRadius: 'var(--radius-md)',
      maxWidth: '70%',
      fontSize: 14
    }
  }, t.text))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      padding: 12,
      borderTop: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(Textarea, {
    rows: 1,
    placeholder: "Type a message...",
    value: draft,
    onChange: e => setDraft(e.target.value)
  })), /*#__PURE__*/React.createElement(Button, {
    onClick: () => setDraft('')
  }, "Send"))));
}
window.MessagesScreen = MessagesScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/lumno-admin/MessagesScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/lumno-admin/NotesScreen.jsx
try { (() => {
const {
  Card,
  Avatar,
  Tag,
  Input,
  Dialog,
  Textarea,
  Button
} = window.LumnoDesignSystem_956520;
const NOTES = [{
  id: 1,
  name: 'Maria Chen',
  date: 'Aug 18',
  ai: true,
  snippet: 'Client reported improved sleep this week. Continued CBT exercises around morning anxiety...'
}, {
  id: 2,
  name: 'James Okoro',
  date: 'Aug 15',
  ai: false,
  snippet: 'Discussed communication patterns identified in last joint session. Homework assigned.'
}, {
  id: 3,
  name: 'Priya Nair',
  date: 'Aug 13',
  ai: true,
  snippet: 'Mood scale 6/10, up from 4/10 two weeks ago. Discussed medication check-in with PCP...'
}];
function NotesScreen() {
  const [query, setQuery] = React.useState('');
  const [selected, setSelected] = React.useState(null);
  const filtered = NOTES.filter(n => n.name.toLowerCase().includes(query.toLowerCase()));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 32
    }
  }, "Session notes"), /*#__PURE__*/React.createElement(Input, {
    placeholder: "Search notes by client",
    value: query,
    onChange: e => setQuery(e.target.value)
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, filtered.map(n => /*#__PURE__*/React.createElement(Card, {
    key: n.id,
    interactive: true
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => setSelected(n),
    style: {
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: n.name,
    size: 32
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 14
    }
  }, n.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--text-muted)'
    }
  }, n.date), n.ai && /*#__PURE__*/React.createElement(Tag, {
    color: "plum"
  }, "AI-drafted")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--text-secondary)',
      marginTop: 8,
      lineHeight: 'var(--lh-normal)'
    }
  }, n.snippet))))), /*#__PURE__*/React.createElement(Dialog, {
    open: !!selected,
    title: selected ? `${selected.name} · ${selected.date}` : '',
    onClose: () => setSelected(null),
    footer: /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      onClick: () => setSelected(null)
    }, "Save")
  }, selected && /*#__PURE__*/React.createElement(Textarea, {
    rows: 8,
    defaultValue: selected.snippet,
    helper: selected.ai ? 'AI-drafted from session audio — review before saving.' : 'Autosaves every 30 seconds'
  })));
}
window.NotesScreen = NotesScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/lumno-admin/NotesScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/lumno-admin/PaymentsScreen.jsx
try { (() => {
const {
  StatCard,
  Card,
  Avatar,
  Badge,
  Button,
  Dialog,
  Select,
  Input
} = window.LumnoDesignSystem_956520;
const INVOICES = [{
  id: 1,
  name: 'Maria Chen',
  amount: '$150',
  date: 'Aug 12',
  status: 'paid'
}, {
  id: 2,
  name: 'James Okoro',
  amount: '$150',
  date: 'Aug 14',
  status: 'pending'
}, {
  id: 3,
  name: 'Priya Nair',
  amount: '$150',
  date: 'Aug 8',
  status: 'paid'
}, {
  id: 4,
  name: 'Sofia Delgado',
  amount: '$150',
  date: 'Jul 30',
  status: 'overdue'
}];
const STATUS_TONE = {
  paid: 'success',
  pending: 'warning',
  overdue: 'danger'
};
function PaymentsScreen({
  clients
}) {
  const [open, setOpen] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 32
    }
  }, "Payments"), /*#__PURE__*/React.createElement(Button, {
    variant: "pop",
    onClick: () => setOpen(true)
  }, "+ Record payment")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "Revenue this month",
    value: "$1,860",
    delta: "+12% vs last month",
    accent: "sage"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Outstanding",
    value: "$300",
    accent: "citrus"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "Paid invoices",
    value: "11",
    accent: "plum"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, INVOICES.map(inv => /*#__PURE__*/React.createElement(Card, {
    key: inv.id
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: inv.name
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700
    }
  }, inv.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--text-muted)'
    }
  }, inv.date)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: 14
    }
  }, inv.amount), /*#__PURE__*/React.createElement(Badge, {
    tone: STATUS_TONE[inv.status]
  }, inv.status))))), /*#__PURE__*/React.createElement(Dialog, {
    open: open,
    title: "Record a payment",
    onClose: () => setOpen(false),
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      onClick: () => setOpen(false)
    }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      onClick: () => setOpen(false)
    }, "Record payment"))
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Select, {
    label: "Client",
    options: clients.map(c => c.name)
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Amount",
    placeholder: "$150"
  }), /*#__PURE__*/React.createElement(Select, {
    label: "Method",
    options: ['Card on file', 'Bank transfer', 'Cash']
  }))));
}
window.PaymentsScreen = PaymentsScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/lumno-admin/PaymentsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/lumno-admin/ScheduleScreen.jsx
try { (() => {
const {
  Switch,
  Dialog,
  Select,
  Input,
  Button
} = window.LumnoDesignSystem_956520;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const SLOTS = {
  Mon: [{
    time: '9:30',
    name: 'Priya Nair',
    color: 'var(--sage-300)'
  }],
  Tue: [{
    time: '10:00',
    name: 'James Okoro',
    color: 'var(--plum-300)'
  }],
  Wed: [],
  Thu: [{
    time: '9:30',
    name: 'Priya Nair',
    color: 'var(--sage-300)'
  }, {
    time: '2:00',
    name: 'Maria Chen',
    color: 'var(--coral-300)'
  }],
  Fri: [{
    time: '13:00',
    name: 'Leo Fischer',
    color: 'var(--citrus-300)'
  }]
};
function ScheduleScreen({
  clients
}) {
  const [showCancelled, setShowCancelled] = React.useState(false);
  const [newOpen, setNewOpen] = React.useState(false);
  const [detail, setDetail] = React.useState(null);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 32
    }
  }, "Schedule"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 16,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Switch, {
    label: "Show cancelled",
    checked: showCancelled,
    onChange: setShowCancelled
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "pop",
    onClick: () => setNewOpen(true)
  }, "+ New session"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5,1fr)',
      gap: 12
    }
  }, DAYS.map(d => /*#__PURE__*/React.createElement("div", {
    key: d,
    style: {
      background: 'var(--surface-canvas)',
      borderRadius: 'var(--radius-md)',
      padding: 10,
      minHeight: 220
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: 'var(--text-muted)',
      letterSpacing: 'var(--ls-wide)',
      textTransform: 'uppercase',
      marginBottom: 8
    }
  }, d), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, SLOTS[d].map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    onClick: () => setDetail({
      ...s,
      day: d
    }),
    style: {
      background: s.color,
      borderRadius: 'var(--radius-sm)',
      padding: 8,
      fontSize: 13,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700
    }
  }, s.time), /*#__PURE__*/React.createElement("div", null, s.name))))))), /*#__PURE__*/React.createElement(Dialog, {
    open: newOpen,
    title: "New session",
    onClose: () => setNewOpen(false),
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      onClick: () => setNewOpen(false)
    }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      onClick: () => setNewOpen(false)
    }, "Schedule"))
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Select, {
    label: "Client",
    options: clients.map(c => c.name)
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Date",
    type: "date"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Time",
    type: "time"
  }), /*#__PURE__*/React.createElement(Select, {
    label: "Session type",
    options: ['In-person', 'Video', 'Phone']
  }))), /*#__PURE__*/React.createElement(Dialog, {
    open: !!detail,
    title: detail ? detail.name : '',
    onClose: () => setDetail(null),
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      onClick: () => setDetail(null)
    }, "Reschedule"), /*#__PURE__*/React.createElement(Button, {
      variant: "danger",
      onClick: () => setDetail(null)
    }, "Cancel session"))
  }, detail && /*#__PURE__*/React.createElement("div", null, detail.day, " \xB7 ", detail.time)));
}
window.ScheduleScreen = ScheduleScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/lumno-admin/ScheduleScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/lumno-admin/SettingsScreen.jsx
try { (() => {
const {
  Tabs,
  Input,
  Select,
  Switch,
  Checkbox,
  Button
} = window.LumnoDesignSystem_956520;
function SettingsScreen() {
  const [tab, setTab] = React.useState('Profile');
  const [remind, setRemind] = React.useState(true);
  const [sms, setSms] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
      maxWidth: 520
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 32
    }
  }, "Settings"), /*#__PURE__*/React.createElement(Tabs, {
    tabs: ['Profile', 'Notifications', 'Billing'],
    active: tab,
    onChange: setTab
  }), tab === 'Profile' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Full name",
    value: "Dana Reyes"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "License number",
    value: "LMFT-88213"
  }), /*#__PURE__*/React.createElement(Select, {
    label: "Time zone",
    options: ['Eastern (US)', 'Central (US)', 'Pacific (US)']
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "primary"
  }, "Save changes")), tab === 'Notifications' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Switch, {
    label: "Email reminders",
    checked: remind,
    onChange: setRemind
  }), /*#__PURE__*/React.createElement(Switch, {
    label: "SMS reminders",
    checked: sms,
    onChange: setSms
  }), /*#__PURE__*/React.createElement(Checkbox, {
    label: "Weekly summary email",
    checked: true
  })), tab === 'Billing' && /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--text-secondary)',
      fontSize: 14
    }
  }, "No outstanding balance. Next invoice: Sept 1."));
}
window.SettingsScreen = SettingsScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/lumno-admin/SettingsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/lumno-admin/data.js
try { (() => {
window.CLIENTS = [{
  id: 1,
  name: 'Maria Chen',
  tags: [['sage', 'Anxiety'], ['coral', 'Teen']],
  next: 'Today · 2:00 PM',
  status: 'confirmed'
}, {
  id: 2,
  name: 'James Okoro',
  tags: [['plum', 'Couples']],
  next: 'Tomorrow · 10:00 AM',
  status: 'pending'
}, {
  id: 3,
  name: 'Priya Nair',
  tags: [['sage', 'Depression']],
  next: 'Thu · 9:30 AM',
  status: 'confirmed'
}, {
  id: 4,
  name: 'Leo Fischer',
  tags: [['citrus', 'Priority'], ['coral', 'Teen']],
  next: 'Fri · 1:00 PM',
  status: 'confirmed'
}, {
  id: 5,
  name: 'Sofia Delgado',
  tags: [['plum', 'Couples']],
  next: 'Not scheduled',
  status: 'cancelled'
}];
window.MESSAGES = [{
  id: 1,
  name: 'Maria Chen',
  preview: "See you at 2pm today, thank you!",
  unread: 2,
  thread: [{
    from: 'them',
    text: 'Hi! Just confirming our session today at 2pm'
  }, {
    from: 'me',
    text: "Confirmed — see you then, Maria."
  }, {
    from: 'them',
    text: 'See you at 2pm today, thank you!'
  }]
}, {
  id: 2,
  name: 'James Okoro',
  preview: 'Can we move to a video session this week?',
  unread: 0,
  thread: [{
    from: 'them',
    text: 'Can we move to a video session this week?'
  }, {
    from: 'me',
    text: 'Of course — I moved Thursday to video, link is in your portal.'
  }]
}, {
  id: 3,
  name: 'Priya Nair',
  preview: 'Thank you for the notes from last time.',
  unread: 0,
  thread: [{
    from: 'them',
    text: 'Thank you for the notes from last time.'
  }]
}];
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/lumno-admin/data.js", error: String((e && e.message) || e) }); }

// ui_kits/lumno-marketing/Home.jsx
try { (() => {
const {
  StatCard,
  Card,
  Avatar,
  Badge,
  Button
} = window.LumnoDesignSystem_956520;
const FEATURES = [['calendar', 'Calendar & booking', 'Clients book real openings from your live calendar — you keep the final say.'], ['credit-card', 'Payment handling', 'Invoices, receipts, and card payments, handled quietly in the background.'], ['bell', 'Automated reminders', 'Fewer no-shows, without sending another manual text.'], ['sparkles', 'AI session notes', 'Start from a first draft, written the moment the session ends.'], ['message-circle', 'Secure messaging', 'A private line to your clients, kept out of your personal inbox.'], ['shield', 'Client records', 'Every note, form, and history in one place, whenever you need it.']];
function HeroPreview() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-lg)',
      padding: 24,
      width: 460
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    label: "Sessions this week",
    value: "12",
    accent: "plum"
  }), /*#__PURE__*/React.createElement(StatCard, {
    label: "New clients",
    value: "3",
    accent: "coral"
  })), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: "Maria Chen"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 14
    }
  }, "Maria Chen"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--text-muted)'
    }
  }, "Today \xB7 2:00 PM")), /*#__PURE__*/React.createElement(Badge, {
    tone: "success"
  }, "confirmed"))));
}
function Home() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-body)',
      background: 'var(--surface-app)',
      minHeight: '100vh'
    }
  }, /*#__PURE__*/React.createElement(window.NavBar, {
    active: "Home"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 48,
      padding: '80px 48px',
      maxWidth: 1280,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 64,
      lineHeight: 'var(--lh-tight)',
      color: 'var(--text-primary)'
    }
  }, "Practice management that finally feels ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontStyle: 'italic',
      color: 'var(--accent-primary)'
    }
  }, "calm"), "."), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18,
      color: 'var(--text-secondary)',
      marginTop: 20,
      maxWidth: 480,
      lineHeight: 'var(--lh-relaxed)'
    }
  }, "Scheduling, payments, notes, and reminders \u2014 the parts of running a therapy practice that shouldn't feel like running a business."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      marginTop: 32
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "register.html",
    style: {
      textDecoration: 'none'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg"
  }, "Get started")), /*#__PURE__*/React.createElement("a", {
    href: "pricing.html",
    style: {
      textDecoration: 'none'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "lg"
  }, "See pricing")))), /*#__PURE__*/React.createElement(HeroPreview, null)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '40px 48px 90px',
      maxWidth: 1280,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 34,
      textAlign: 'center',
      marginBottom: 44
    }
  }, "Everything your practice runs on"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 20
    }
  }, FEATURES.map(([icon, title, desc]) => /*#__PURE__*/React.createElement("div", {
    key: title,
    style: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-xs)',
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 'var(--radius-sm)',
      background: 'var(--plum-300)',
      color: 'var(--plum-700)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(window.Icon, {
    name: icon,
    size: 20
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 17,
      marginBottom: 6
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: 'var(--text-secondary)',
      lineHeight: 'var(--lh-relaxed)'
    }
  }, desc))))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--beige-900)',
      color: 'var(--text-inverse)',
      padding: '56px 48px',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontStyle: 'italic',
      fontSize: 32
    }
  }, "Spend less time on the practice, more time in the room."), /*#__PURE__*/React.createElement("a", {
    href: "register.html",
    style: {
      textDecoration: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-block',
      marginTop: 22
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "pop",
    size: "lg"
  }, "Get started")))), /*#__PURE__*/React.createElement(window.Footer, null));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(Home, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/lumno-marketing/Home.jsx", error: String((e && e.message) || e) }); }

// ui_kits/lumno-marketing/Login.jsx
try { (() => {
const {
  Input,
  Button
} = window.LumnoDesignSystem_956520;
function AuthCard({
  title,
  subtitle,
  children,
  footer
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--surface-app)',
      fontFamily: 'var(--font-body)'
    }
  }, /*#__PURE__*/React.createElement(window.NavBar, {
    active: ""
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 380,
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-md)',
      padding: 36
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 30
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: 'var(--text-muted)',
      marginTop: 4,
      marginBottom: 24
    }
  }, subtitle), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, children), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20,
      fontSize: 13,
      color: 'var(--text-secondary)',
      textAlign: 'center'
    }
  }, footer))), /*#__PURE__*/React.createElement(window.Footer, null));
}
function Login() {
  return /*#__PURE__*/React.createElement(AuthCard, {
    title: "Welcome back",
    subtitle: "Log in to your practice",
    footer: /*#__PURE__*/React.createElement("span", null, "Don't have an account? ", /*#__PURE__*/React.createElement("a", {
      href: "register.html",
      style: {
        color: 'var(--accent-primary)',
        fontWeight: 700
      }
    }, "Register"))
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Email",
    placeholder: "you@practice.com",
    type: "email"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Password",
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
    type: "password"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      fontSize: 13,
      color: 'var(--text-muted)'
    }
  }, "Forgot password?")), /*#__PURE__*/React.createElement(Button, {
    variant: "primary"
  }, "Log in"));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(Login, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/lumno-marketing/Login.jsx", error: String((e && e.message) || e) }); }

// ui_kits/lumno-marketing/Pricing.jsx
try { (() => {
const {
  Button,
  Badge
} = window.LumnoDesignSystem_956520;
const TIERS = [{
  name: 'Solo',
  price: '1,000',
  desc: 'For independent therapists running their own practice.',
  features: ['Unlimited clients & scheduling', 'Payment handling & invoicing', 'Automated reminders', 'AI session notes', 'Secure client messaging', 'Email support']
}, {
  name: 'Practice',
  price: '2,000',
  desc: 'For group practices with multiple providers.',
  popular: true,
  features: ['Everything in Solo', 'Multiple provider seats', 'Custom branding', 'Priority support', 'Dedicated onboarding', 'Practice-wide reporting']
}];
function Pricing() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100vh',
      background: 'var(--surface-app)',
      fontFamily: 'var(--font-body)'
    }
  }, /*#__PURE__*/React.createElement(window.NavBar, {
    active: "Pricing"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 900,
      margin: '0 auto',
      padding: '72px 24px 90px',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 48
    }
  }, "Simple, practice-sized pricing"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: 'var(--text-secondary)',
      marginTop: 12,
      maxWidth: 520,
      marginLeft: 'auto',
      marginRight: 'auto'
    }
  }, "One flat monthly rate. No per-client fees, no surprise add-ons."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 24,
      marginTop: 48,
      textAlign: 'left'
    }
  }, TIERS.map(t => /*#__PURE__*/React.createElement("div", {
    key: t.name,
    style: {
      flex: 1,
      background: 'var(--surface-card)',
      borderRadius: 'var(--radius-lg)',
      padding: 32,
      border: t.popular ? '2px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
      boxShadow: t.popular ? 'var(--shadow-lg)' : 'var(--shadow-xs)',
      position: 'relative'
    }
  }, t.popular && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: -13,
      left: 32
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "plum"
  }, "Most popular")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 26
    }
  }, t.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: 'var(--text-muted)',
      marginTop: 6,
      minHeight: 36
    }
  }, t.desc), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 6,
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 44
    }
  }, "$", t.price), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: 'var(--text-muted)'
    }
  }, "/month")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "register.html",
    style: {
      textDecoration: 'none'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: t.popular ? 'primary' : 'secondary',
    size: "lg"
  }, "Get started"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      marginTop: 26
    }
  }, t.features.map(f => /*#__PURE__*/React.createElement("div", {
    key: f,
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      fontSize: 14,
      color: 'var(--text-secondary)'
    }
  }, /*#__PURE__*/React.createElement(window.Icon, {
    name: "check",
    size: 16
  }), " ", f))))))), /*#__PURE__*/React.createElement(window.Footer, null));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(Pricing, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/lumno-marketing/Pricing.jsx", error: String((e && e.message) || e) }); }

// ui_kits/lumno-marketing/Register.jsx
try { (() => {
const {
  Input,
  Button
} = window.LumnoDesignSystem_956520;
function Register() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--surface-app)',
      fontFamily: 'var(--font-body)'
    }
  }, /*#__PURE__*/React.createElement(window.NavBar, {
    active: ""
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 380,
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-md)',
      padding: 36
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 30
    }
  }, "Create your account"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: 'var(--text-muted)',
      marginTop: 4,
      marginBottom: 24
    }
  }, "Set up your practice in about two minutes"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Full name",
    placeholder: "Dana Reyes"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Email",
    placeholder: "you@practice.com",
    type: "email"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Password",
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
    type: "password"
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "primary"
  }, "Create account")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20,
      fontSize: 13,
      color: 'var(--text-secondary)',
      textAlign: 'center'
    }
  }, "Already have an account? ", /*#__PURE__*/React.createElement("a", {
    href: "login.html",
    style: {
      color: 'var(--accent-primary)',
      fontWeight: 700
    }
  }, "Log in")))), /*#__PURE__*/React.createElement(window.Footer, null));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(Register, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/lumno-marketing/Register.jsx", error: String((e && e.message) || e) }); }

// ui_kits/lumno-marketing/shared.jsx
try { (() => {
function Icon({
  name,
  size = 18
}) {
  React.useEffect(() => {
    if (window.lucide) window.lucide.createIcons({
      nameAttr: 'data-lucide',
      attrs: {
        width: size,
        height: size
      }
    });
  });
  return /*#__PURE__*/React.createElement("i", {
    "data-lucide": name
  });
}
function NavBar({
  active
}) {
  const links = [['Home', 'index.html'], ['Pricing', 'pricing.html'], ['Log in', 'login.html']];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '20px 48px',
      borderBottom: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "index.html",
    style: {
      fontFamily: 'var(--font-display)',
      fontStyle: 'italic',
      fontSize: 26,
      color: 'var(--text-primary)',
      textDecoration: 'none'
    }
  }, "Lumno"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 28
    }
  }, links.map(([label, href]) => /*#__PURE__*/React.createElement("a", {
    key: label,
    href: href,
    style: {
      fontFamily: 'var(--font-body)',
      fontSize: 14,
      fontWeight: 600,
      textDecoration: 'none',
      color: active === label ? 'var(--accent-primary)' : 'var(--text-secondary)'
    }
  }, label)), /*#__PURE__*/React.createElement("a", {
    href: "register.html",
    style: {
      textDecoration: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      background: 'var(--accent-primary)',
      color: 'var(--text-on-accent)',
      fontFamily: 'var(--font-body)',
      fontWeight: 700,
      fontSize: 14,
      padding: '9px 18px',
      borderRadius: 'var(--radius-sm)',
      display: 'inline-block'
    }
  }, "Get started"))));
}
function Footer() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--border-subtle)',
      padding: '28px 48px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontFamily: 'var(--font-body)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontStyle: 'italic',
      fontSize: 18,
      color: 'var(--text-primary)'
    }
  }, "Lumno"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--text-muted)'
    }
  }, "\xA9 2026 Lumno. Practice management for therapists."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "index.html",
    style: {
      fontSize: 13,
      color: 'var(--text-muted)'
    }
  }, "Home"), /*#__PURE__*/React.createElement("a", {
    href: "pricing.html",
    style: {
      fontSize: 13,
      color: 'var(--text-muted)'
    }
  }, "Pricing"), /*#__PURE__*/React.createElement("a", {
    href: "login.html",
    style: {
      fontSize: 13,
      color: 'var(--text-muted)'
    }
  }, "Log in")));
}
window.Icon = Icon;
window.NavBar = NavBar;
window.Footer = Footer;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/lumno-marketing/shared.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.StatCard = __ds_scope.StatCard;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.Tooltip = __ds_scope.Tooltip;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Radio = __ds_scope.Radio;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Textarea = __ds_scope.Textarea;

__ds_ns.SidebarNavItem = __ds_scope.SidebarNavItem;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.TopBar = __ds_scope.TopBar;

})();
