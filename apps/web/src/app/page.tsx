import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Search,
  Share2,
  Users,
  Zap,
  Star,
  Code2,
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen gradient-bg">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background"></div>
        <div className="relative px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
          <div className="mx-auto max-w-4xl text-center">
            {/* Badge */}
            <div className="mb-8 flex justify-center">
              <Badge
                variant="secondary"
                className="px-4 py-2 text-sm font-medium glow-border"
              >
                <Zap className="mr-2 h-4 w-4" />
                AI-Powered Directory
              </Badge>
            </div>

            {/* Main Heading */}
            <h1 className="mb-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              <span className="block">The Ultimate</span>
              <span className="block bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text">
                AI Rules Directory
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Discover, share, and collaborate on the best AI prompts, rules,
              and patterns. Built by developers, for developers.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Link href="/rules">
                <Button
                  size="lg"
                  className="group w-full sm:w-auto glow-border"
                >
                  <Search className="mr-2 h-5 w-5" />
                  Explore Rules
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link href="/examples">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  <Code2 className="mr-2 h-5 w-5" />
                  View Examples
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground sm:text-4xl">
              Everything you need to build better AI
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              From prompts to patterns, discover the tools and knowledge to
              enhance your AI development workflow.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <Card className="gradient-card border-0 transition-all duration-300 hover:scale-105 hover:glow-border">
              <CardHeader className="pb-4">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Search className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Discover</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Find curated AI prompts and rules
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Browse our comprehensive collection of battle-tested AI
                  prompts, rules, and patterns created and refined by the
                  community.
                </p>
              </CardContent>
            </Card>

            {/* Feature 2 */}
            <Card className="gradient-card border-0 transition-all duration-300 hover:scale-105 hover:glow-border">
              <CardHeader className="pb-4">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Share2 className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Contribute</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Share your knowledge with the world
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Contribute your own prompts, rules, and insights. Help build
                  the most comprehensive AI development resource library.
                </p>
              </CardContent>
            </Card>

            {/* Feature 3 */}
            <Card className="gradient-card border-0 transition-all duration-300 hover:scale-105 hover:glow-border sm:col-span-2 lg:col-span-1">
              <CardHeader className="pb-4">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Collaborate</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Build together with the community
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Vote, comment, and improve content collaboratively. Join a
                  thriving community of AI developers and researchers.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Card className="gradient-card border-0 glow-border">
            <CardContent className="p-8 sm:p-12">
              <div className="grid gap-8 sm:grid-cols-3">
                <div className="text-center">
                  <div className="mb-2 text-3xl font-bold text-primary sm:text-4xl">
                    1000+
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Curated Rules
                  </div>
                </div>
                <div className="text-center">
                  <div className="mb-2 text-3xl font-bold text-primary sm:text-4xl">
                    500+
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Contributors
                  </div>
                </div>
                <div className="text-center">
                  <div className="mb-2 text-3xl font-bold text-primary sm:text-4xl">
                    10k+
                  </div>
                  <div className="text-sm text-muted-foreground">Downloads</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-foreground sm:text-4xl">
            Ready to enhance your AI workflow?
          </h2>
          <p className="mb-8 text-lg text-muted-foreground">
            Join thousands of developers who are already using our curated
            collection to build better AI applications.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link href="/rules">
              <Button size="lg" className="group w-full sm:w-auto glow-border">
                <Star className="mr-2 h-5 w-5" />
                Start Exploring
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
