"use client";

type IconProps = {
  className?: string;
};

function BaseIcon({ className = "", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function LabsIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M4 20v-7l8-4 8 4v7" />
      <path d="M7 20v-4h10v4" />
      <path d="M12 5V3" />
      <path d="M9 9h6" />
    </BaseIcon>
  );
}

export function ReagentsIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M10 3v5.2l-3.7 6.1A4 4 0 0 0 9.7 20h4.6a4 4 0 0 0 3.4-5.7L14 8.2V3" />
      <path d="M9 8h6" />
      <path d="M9 14c1.4-.6 2.8-.6 4.2 0s2.8.6 4.2 0" />
    </BaseIcon>
  );
}

export function AddReagentIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M10 3v5.2l-3.7 6.1A4 4 0 0 0 9.7 20h4.6a4 4 0 0 0 3.4-5.7L14 8.2V3" />
      <path d="M9 8h6" />
      <path d="M18.5 5.5v5" />
      <path d="M16 8h5" />
    </BaseIcon>
  );
}

export function ExperimentIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M5 20h14" />
      <path d="M7 20l2.8-8.4V4.5A1.5 1.5 0 0 1 11.3 3h1.4a1.5 1.5 0 0 1 1.5 1.5v7.1L17 20" />
      <path d="M9.8 12.3c1.2.5 2.4.8 3.7.8 1.1 0 2.2-.2 3.2-.6" />
      <circle cx="17.5" cy="6.5" r="0.5" />
      <circle cx="15.3" cy="4.3" r="0.5" />
    </BaseIcon>
  );
}

export function SettingsIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <BaseIcon className={className}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.7 1.7 0 0 1-2.4 2.4l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a1.7 1.7 0 0 1-3.4 0v-.2a1 1 0 0 0-.7-.9 1 1 0 0 0-1.1.2l-.1.1a1.7 1.7 0 0 1-2.4-2.4l.1-.1A1 1 0 0 0 8 15a1 1 0 0 0-.9-.6H7a1.7 1.7 0 0 1 0-3.4h.2a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1.1l-.1-.1a1.7 1.7 0 0 1 2.4-2.4l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .6-.9V4a1.7 1.7 0 0 1 3.4 0v.2a1 1 0 0 0 .6.9h.1a1 1 0 0 0 1.1-.2l.1-.1a1.7 1.7 0 0 1 2.4 2.4l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.6h.2a1.7 1.7 0 0 1 0 3.4h-.2a1 1 0 0 0-.9.6Z" />
    </BaseIcon>
  );
}

export function KnowledgeIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M6 5.5A2.5 2.5 0 0 1 8.5 3H20v15h-11.5A2.5 2.5 0 0 0 6 20.5V5.5Z" />
      <path d="M6 5.5A2.5 2.5 0 0 0 3.5 3H2v15h1.5A2.5 2.5 0 0 1 6 20.5" />
      <path d="M9.5 7.5h7" />
      <path d="M9.5 11h7" />
      <path d="M9.5 14.5h4.5" />
    </BaseIcon>
  );
}

/** Navigation-only icons use a new, task-first visual language. */
export function SidebarLabsIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M4 20h16" />
      <path d="M5.5 16h13v4h-13z" />
      <path d="M7 3v8.5a2 2 0 0 0 4 0V3" />
      <path d="M13 5v6.5a2 2 0 0 0 4 0V5" />
      <path d="M7 8h4" />
      <path d="M13 9h4" />
    </BaseIcon>
  );
}

export function SidebarReagentsIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <BaseIcon className={className}>
      <rect x="4" y="3" width="5" height="7" rx="1.4" />
      <path d="M5.5 3V2h2v1" />
      <path d="M6 7h1" />
      <rect x="4" y="14" width="5" height="7" rx="1.4" />
      <path d="M5.5 14v-1h2v1" />
      <path d="M6 18h1" />
      <path d="M12 5h8" />
      <path d="M12 9h5" />
      <path d="M12 16h8" />
      <path d="M12 20h5" />
    </BaseIcon>
  );
}

export function SidebarAnimalsIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M7.2 10.4c-1.8-1.7-3-4.3-2.2-6.7 2.2.6 3.8 2.2 4.7 4.2" />
      <path d="M14.8 8.1c.8-2.1 2.5-3.8 4.7-4.4.8 2.5-.5 5.1-2.3 6.8" />
      <path d="M6.4 12.4c0-3.2 2.5-5.7 5.6-5.7s5.6 2.5 5.6 5.7v2.1c0 3.2-2.5 5.8-5.6 5.8s-5.6-2.6-5.6-5.8v-2.1Z" />
      <circle cx="9.7" cy="13.3" r=".7" fill="currentColor" stroke="none" />
      <circle cx="14.3" cy="13.3" r=".7" fill="currentColor" stroke="none" />
      <path d="M10.4 16.1c1 .8 2.2.8 3.2 0" />
    </BaseIcon>
  );
}

export function SidebarAddReagentIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M11 3.5S5.5 10 5.5 14.2A5.5 5.5 0 0 0 16.5 14.2C16.5 10 11 3.5 11 3.5Z" />
      <path d="M8.5 15.5c.55 1.15 1.4 1.75 2.5 1.75" />
      <path d="M19 4v5" />
      <path d="M16.5 6.5h5" />
    </BaseIcon>
  );
}

export function SidebarExperimentCheckIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <BaseIcon className={className}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V2.5h6V4" />
      <path d="m8.5 12 2.2 2.2 4.8-4.8" />
      <path d="M9 18h6" />
    </BaseIcon>
  );
}

export function SidebarKnowledgeIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <BaseIcon className={className}>
      <circle cx="12" cy="12" r="2.2" />
      <ellipse cx="12" cy="12" rx="8" ry="3.7" />
      <ellipse cx="12" cy="12" rx="3.7" ry="8" transform="rotate(60 12 12)" />
      <circle cx="17.6" cy="8.7" r=".9" />
    </BaseIcon>
  );
}

export function SidebarSettingsIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
      <circle cx="9" cy="6" r="2" />
      <circle cx="16" cy="12" r="2" />
      <circle cx="7" cy="18" r="2" />
    </BaseIcon>
  );
}

export function SortIcon({ className = "" }: IconProps) {
  return (
    <BaseIcon className={`h-3.5 w-3.5 shrink-0${className ? ` ${className}` : ""}`}>
      <path d="m8 7 4-4 4 4" />
      <path d="m16 17-4 4-4-4" />
    </BaseIcon>
  );
}

export function MenuIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </BaseIcon>
  );
}

export function CloseIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </BaseIcon>
  );
}

export function SearchIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <BaseIcon className={className}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </BaseIcon>
  );
}

export function CheckIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </BaseIcon>
  );
}

export function AlertIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M12 4 2.8 19.5h18.4L12 4Z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </BaseIcon>
  );
}

export function CopyIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <BaseIcon className={className}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </BaseIcon>
  );
}

export function UploadIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M12 16V4" />
      <path d="m6.5 9.5 5.5-5.5 5.5 5.5" />
      <path d="M4 20h16" />
    </BaseIcon>
  );
}

export function ChevronDownIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="m6 9 6 6 6-6" />
    </BaseIcon>
  );
}

export function PlusIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </BaseIcon>
  );
}

export function MinusIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M5 12h14" />
    </BaseIcon>
  );
}

export function EditIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </BaseIcon>
  );
}

export function TrashIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </BaseIcon>
  );
}
