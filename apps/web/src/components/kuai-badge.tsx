export function KuaiBadge({ cost }: { cost: number }) {
  return (
    <span className="inline-flex h-6 min-w-6 items-center gap-1 rounded-full bg-[#f5f0e8] px-2 py-0 text-xs font-medium text-[#7a5c2e] dark:bg-[#2a2318] dark:text-[#c8a96e]">
      块 {cost}
    </span>
  );
}
