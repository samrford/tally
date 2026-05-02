import { Moon, Sun, Monitor } from 'lucide-react'
import { useTheme } from '@/lib/theme'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor
  const label =
    theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'System'

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${label} (click to switch)`}
      title={`Theme: ${label}`}
    >
      <Icon className="h-4 w-4" />
    </Button>
  )
}
