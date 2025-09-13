import Link from "next/link";

const footerLinks = [
  {
    title: "Product",
    links: [
      { label: "Rules", href: "/rules" },
      { label: "Leaderboards", href: "/leaderboards" },
      { label: "Authors", href: "/authors" },
      { label: "Submit Rule", href: "/submit" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "GitHub", href: "https://github.com" },
      { label: "Discord", href: "https://discord.gg" },
      { label: "Twitter", href: "https://twitter.com" },
      { label: "Blog", href: "/blog" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Code of Conduct", href: "/code-of-conduct" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link
              href="/"
              className="flex items-center space-x-2 font-bold text-xl"
              aria-label="Core Directory Engine - Home"
            >
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">
                  CD
                </span>
              </div>
              <span>Core Directory</span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs">
              Discover, share, and collaborate on the best rules and patterns
              for modern development.
            </p>
          </div>

          {/* Links */}
          {footerLinks.map((section) => (
            <div key={section.title} className="space-y-4">
              <h3 className="font-semibold">{section.title}</h3>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      {...(link.href.startsWith("http") && {
                        target: "_blank",
                        rel: "noopener noreferrer",
                      })}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-8 border-t flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Core Directory Engine. All rights
            reserved.
          </p>
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <span>Made with ❤️ for developers</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
