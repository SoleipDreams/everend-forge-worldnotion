import {
  Children,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type FocusEvent,
  type SelectHTMLAttributes,
} from "react";
import { ChevronDown } from "lucide-react";

interface SelectOption {
  value: string;
  label: ReactNode;
  text: string;
  disabled: boolean;
}

interface SelectOptionGroup {
  label?: string;
  options: SelectOption[];
}

function textContent(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") return String(child);
      if (isValidElement<{ children?: ReactNode }>(child)) return textContent(child.props.children);
      return "";
    })
    .join("");
}

function optionGroups(children: ReactNode): SelectOptionGroup[] {
  const groups: SelectOptionGroup[] = [];
  const appendOption = (option: SelectOption, label?: string) => {
    const previous = groups.at(-1);
    if (previous && previous.label === label) previous.options.push(option);
    else groups.push({ label, options: [option] });
  };

  Children.forEach(children, (child) => {
    if (
      !isValidElement<{
        children?: ReactNode;
        value?: unknown;
        label?: string;
        disabled?: boolean;
      }>(child)
    )
      return;
    if (child.type === "option") {
      const value =
        child.props.value == null ? textContent(child.props.children) : String(child.props.value);
      const label = child.props.label ?? child.props.children;
      appendOption({
        value,
        label,
        text: child.props.label ?? textContent(child.props.children),
        disabled: Boolean(child.props.disabled),
      });
    } else if (child.type === "optgroup") {
      const label = child.props.label ?? "";
      Children.forEach(child.props.children, (option) => {
        if (
          !isValidElement<{
            children?: ReactNode;
            value?: unknown;
            label?: string;
            disabled?: boolean;
          }>(option) ||
          option.type !== "option"
        )
          return;
        const value =
          option.props.value == null
            ? textContent(option.props.children)
            : String(option.props.value);
        const optionLabel = option.props.label ?? option.props.children;
        appendOption(
          {
            value,
            label: optionLabel,
            text: option.props.label ?? textContent(option.props.children),
            disabled: Boolean(option.props.disabled) || Boolean(child.props.disabled),
          },
          label,
        );
      });
    } else if (child.type === Fragment) {
      for (const nested of optionGroups(child.props.children)) {
        for (const option of nested.options) appendOption(option, nested.label);
      }
    }
  });

  return groups;
}

function enabledIndex(options: SelectOption[], start: number, direction: 1 | -1) {
  for (let step = 0; step < options.length; step += 1) {
    const index = (start + step * direction + options.length) % options.length;
    if (!options[index].disabled) return index;
  }
  return -1;
}

function clippingBounds(element: HTMLElement) {
  const bounds = { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth };
  for (
    let ancestor = element.parentElement;
    ancestor && ancestor !== document.body && ancestor !== document.documentElement;
    ancestor = ancestor.parentElement
  ) {
    const style = window.getComputedStyle(ancestor);
    const clipsY = style.overflowY !== "visible" && style.overflowY !== "unset";
    const clipsX = style.overflowX !== "visible" && style.overflowX !== "unset";
    if (!clipsX && !clipsY) continue;
    const rect = ancestor.getBoundingClientRect();
    const top = rect.top + ancestor.clientTop;
    const left = rect.left + ancestor.clientLeft;
    if (clipsY) {
      bounds.top = Math.max(bounds.top, top);
      bounds.bottom = Math.min(bounds.bottom, top + ancestor.clientHeight);
    }
    if (clipsX) {
      bounds.left = Math.max(bounds.left, left);
      bounds.right = Math.min(bounds.right, left + ancestor.clientWidth);
    }
  }
  return bounds;
}

export function SettingsDropdown(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const {
    children,
    value,
    defaultValue,
    onChange,
    className,
    id,
    name,
    disabled,
    title,
    style,
    autoFocus,
    tabIndex,
    required,
    multiple,
    size,
    onBlur,
    onFocus,
    onInvalid,
    ...nativeProps
  } = props;
  const groups = useMemo(() => optionGroups(children), [children]);
  const options = useMemo(() => groups.flatMap((group) => group.options), [groups]);
  const initialValue = Array.isArray(value)
    ? String(value[0] ?? "")
    : value !== undefined
      ? String(value)
      : Array.isArray(defaultValue)
        ? String(defaultValue[0] ?? "")
        : defaultValue !== undefined
          ? String(defaultValue)
          : (options[0]?.value ?? "");
  const [uncontrolledValue, setUncontrolledValue] = useState(initialValue);
  const selectedValue =
    value === undefined
      ? uncontrolledValue
      : Array.isArray(value)
        ? String(value[0] ?? "")
        : String(value);
  const selectedIndex = options.findIndex((option) => option.value === selectedValue);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const [placement, setPlacement] = useState<"bottom" | "top">("bottom");
  const [alignment, setAlignment] = useState<"start" | "end">("start");
  const [menuMaxHeight, setMenuMaxHeight] = useState(300);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const nativeSelect = useRef<HTMLSelectElement>(null);
  const optionButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  const updateMenuGeometry = useCallback(() => {
    const triggerBounds = trigger.current?.getBoundingClientRect();
    const menuElement = menu.current;
    if (!triggerBounds || !menuElement) return;
    const visibleBounds = clippingBounds(trigger.current!);
    const spaceAbove = Math.max(0, triggerBounds.top - visibleBounds.top - 5);
    const spaceBelow = Math.max(0, visibleBounds.bottom - triggerBounds.bottom - 5);
    const contentHeight = Math.min(menuElement.scrollHeight || 300, 300);
    const openAbove = spaceBelow < contentHeight && spaceAbove > spaceBelow;
    const availableSpace = openAbove ? spaceAbove : spaceBelow;
    setPlacement(openAbove ? "top" : "bottom");
    setMenuMaxHeight(Math.max(1, Math.min(300, availableSpace)));
    setAlignment(
      triggerBounds.right + 360 > visibleBounds.right - 16 &&
        triggerBounds.left - 360 >= visibleBounds.left + 16
        ? "end"
        : "start",
    );
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    optionButtons.current[activeIndex]?.focus();
    updateMenuGeometry();
  }, [open, activeIndex, updateMenuGeometry]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", updateMenuGeometry);
    window.addEventListener("scroll", updateMenuGeometry, true);
    return () => {
      window.removeEventListener("resize", updateMenuGeometry);
      window.removeEventListener("scroll", updateMenuGeometry, true);
    };
  }, [open, updateMenuGeometry]);

  const openMenu = (direction: 1 | -1 = 1) => {
    const start = selectedIndex >= 0 ? selectedIndex : direction === 1 ? 0 : options.length - 1;
    setActiveIndex(enabledIndex(options, start, direction) ?? start);
    setOpen(true);
  };
  const chooseOption = (option: SelectOption) => {
    if (option.disabled) return;
    if (value === undefined) setUncontrolledValue(option.value);
    const select = nativeSelect.current;
    if (select) {
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value",
      )?.set;
      if (valueSetter) valueSetter.call(select, option.value);
      else select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    setOpen(false);
    trigger.current?.focus();
  };
  const moveActive = (from: number, direction: 1 | -1) => {
    const start = (from + direction + options.length) % options.length;
    const next = enabledIndex(options, start, direction);
    if (next >= 0) setActiveIndex(next);
  };

  const triggerAttributes = Object.fromEntries(
    Object.entries(nativeProps).filter(
      ([key]) => key.startsWith("aria-") || key.startsWith("data-"),
    ),
  );
  const labelledBy = props["aria-labelledby"];
  const label = props["aria-label"];
  const groupOffsets = groups.map((_, groupIndex) =>
    groups.slice(0, groupIndex).reduce((total, group) => total + group.options.length, 0),
  );

  return (
    <div ref={root} className="ef-settings-select" data-open={open || undefined}>
      <button
        {...triggerAttributes}
        ref={trigger}
        id={id}
        type="button"
        className={`ef-settings-select-trigger ${className ?? ""}`.trim()}
        style={style}
        title={title}
        disabled={disabled}
        autoFocus={autoFocus}
        tabIndex={tabIndex}
        aria-label={label}
        aria-labelledby={labelledBy}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-required={required || undefined}
        onFocus={(event) => onFocus?.(event as unknown as FocusEvent<HTMLSelectElement>)}
        onBlur={(event) => onBlur?.(event as unknown as FocusEvent<HTMLSelectElement>)}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            openMenu(event.key === "ArrowUp" ? -1 : 1);
          } else if (event.key === "Home" || event.key === "End") {
            event.preventDefault();
            const index =
              event.key === "Home"
                ? enabledIndex(options, 0, 1)
                : enabledIndex(options, options.length - 1, -1);
            if (index >= 0) setActiveIndex(index);
            setOpen(true);
          } else if ((event.key === "Enter" || event.key === " ") && !open) {
            event.preventDefault();
            openMenu();
          } else if (event.key === "Escape" && open) {
            event.preventDefault();
            setOpen(false);
          }
        }}
      >
        <span className="ef-settings-select-value">{selectedOption?.label ?? "—"}</span>
        <ChevronDown className="ef-settings-select-chevron" size={15} aria-hidden="true" />
      </button>
      <select
        {...nativeProps}
        ref={nativeSelect}
        id={id ? `${id}__native` : undefined}
        name={name}
        className="ef-settings-select-native"
        value={value as string | number | readonly string[] | undefined}
        defaultValue={defaultValue as string | number | readonly string[] | undefined}
        disabled={disabled}
        required={required}
        multiple={multiple}
        size={size}
        tabIndex={-1}
        aria-hidden="true"
        onChange={onChange}
        onInvalid={(event: FormEvent<HTMLSelectElement>) => {
          onInvalid?.(event);
          if (!event.defaultPrevented) {
            event.preventDefault();
            openMenu();
            trigger.current?.focus();
          }
        }}
      >
        {children}
      </select>
      {open ? (
        <div
          ref={menu}
          id={menuId}
          className="ef-settings-select-menu"
          data-placement={placement}
          data-align={alignment}
          style={{ maxHeight: menuMaxHeight }}
          role="listbox"
          aria-label={label}
          aria-labelledby={labelledBy}
        >
          {groups.map((group, groupIndex) => {
            const groupStart = groupOffsets[groupIndex] ?? 0;
            return (
              <div
                className="ef-settings-select-group"
                key={`${group.label ?? "options"}-${groupIndex}`}
                role={group.label ? "group" : undefined}
                aria-label={group.label || undefined}
              >
                {group.label ? (
                  <p className="ef-settings-select-group-title" aria-hidden="true">
                    {group.label}
                  </p>
                ) : null}
                {group.options.map((option, index) => {
                  const optionIndex = groupStart + index;
                  return (
                    <button
                      key={`${option.value}-${optionIndex}`}
                      ref={(element) => {
                        optionButtons.current[optionIndex] = element;
                      }}
                      type="button"
                      className="ef-settings-select-option"
                      role="option"
                      aria-selected={option.value === selectedValue}
                      disabled={option.disabled}
                      tabIndex={optionIndex === activeIndex ? 0 : -1}
                      onClick={() => chooseOption(option)}
                      onKeyDown={(event) => {
                        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                          event.preventDefault();
                          moveActive(optionIndex, event.key === "ArrowDown" ? 1 : -1);
                        } else if (event.key === "Home" || event.key === "End") {
                          event.preventDefault();
                          const index =
                            event.key === "Home"
                              ? enabledIndex(options, 0, 1)
                              : enabledIndex(options, options.length - 1, -1);
                          if (index >= 0) setActiveIndex(index);
                        } else if (event.key === "Escape") {
                          event.preventDefault();
                          setOpen(false);
                          trigger.current?.focus();
                        } else if (event.key === "Tab") {
                          setOpen(false);
                        }
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export { SettingsDropdown as WorldNotionDropdown };
