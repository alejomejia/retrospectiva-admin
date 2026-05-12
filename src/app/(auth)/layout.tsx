/**
 * Minimal layout for the unauthenticated surface (currently just /login).
 * Inherits the brand-paper background + DM Sans fonts from the root
 * layout; this just centers the card.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-2xl mx-auto flex flex-1 items-center justify-center px-6 py-16">
      {children}
    </div>
  );
}
