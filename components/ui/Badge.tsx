import { cn } from "@/lib/utils";

const CATEGORY_COLORS: Record<string, string> = {
  餐飲: "bg-orange-100 text-orange-700",
  交通: "bg-blue-100 text-blue-700",
  住宿: "bg-purple-100 text-purple-700",
  購物: "bg-pink-100 text-pink-700",
  娛樂: "bg-yellow-100 text-yellow-700",
  其他: "bg-gray-100 text-gray-600",
};

export function CategoryBadge({ category }: { category?: string | null }) {
  if (!category) return null;
  const color = CATEGORY_COLORS[category] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", color)}>
      {category}
    </span>
  );
}

export const EXPENSE_CATEGORIES = Object.keys(CATEGORY_COLORS);
