export default function Chip({
  icon,
  text,
  onClick,
}: {
  icon?: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm transition-all will-change-transform hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-md active:translate-y-0 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
    >
      {icon && (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-[13px]">
          {icon}
        </span>
      )}
      <span className="whitespace-nowrap">{text}</span>
    </button>
  );
}
