import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  className?: string;
}

export function AnimatedNumber({ value, duration = 600, className }: AnimatedNumberProps) {
  const animatedValue = useAnimatedCounter(value, duration);
  return <span className={className}>{animatedValue}</span>;
}
