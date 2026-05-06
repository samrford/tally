// Decorative blurred-blob backdrop used behind nearly every full-page view.
// Keeps the marketing/auth surface and the in-app surface visually coherent.

interface PageBackdropProps {
  // 'app' — softer, used inside the authenticated app (10/20 opacity).
  // 'auth' — slightly stronger, used on login/signup/passphrase pages.
  variant?: 'app' | 'auth'
}

export function PageBackdrop({ variant = 'app' }: PageBackdropProps) {
  const top = variant === 'auth' ? 'bg-primary/15' : 'bg-primary/10'
  const bottom = variant === 'auth' ? 'bg-accent/30' : 'bg-accent/20'
  return (
    <>
      <div
        className={`fixed top-[-20%] left-[-10%] w-[50%] h-[50%] ${top} rounded-full blur-[150px] pointer-events-none`}
      />
      <div
        className={`fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] ${bottom} rounded-full blur-[150px] pointer-events-none`}
      />
    </>
  )
}
