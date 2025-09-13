import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, TrendingUp, Users, FileText } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import { SearchBar } from "@/components/shell/search-bar";
import { RuleList } from "@/components/rules/rule-list";
import { RuleListSkeleton } from "@/components/rules/skeletons";

export default function HomePage() {
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="relative py-20 bg-gradient-to-br from-background to-muted/20">
        <div className="container">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
                Discover the best{" "}
                <span className="text-primary">rules and patterns</span> for
                modern development
              </h1>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Share, collaborate, and learn from a community-driven collection
                of proven development practices, coding patterns, and best
                practices.
              </p>
            </div>

            <div className="max-w-2xl mx-auto">
              <SearchBar
                placeholder="Search rules, patterns, and guides..."
                className="w-full"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg">
                <Link href="/rules">
                  Browse Rules
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/submit">Submit a Rule</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 border-y bg-muted/20">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <div className="text-3xl font-bold">1,200+</div>
              <div className="text-muted-foreground">Rules & Patterns</div>
            </div>
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <div className="text-3xl font-bold">500+</div>
              <div className="text-muted-foreground">Contributors</div>
            </div>
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center">
                <TrendingUp className="h-8 w-8 text-primary" />
              </div>
              <div className="text-3xl font-bold">50K+</div>
              <div className="text-muted-foreground">Monthly Views</div>
            </div>
          </div>
        </div>
      </section>

      {/* Trending Rules Section */}
      <section className="py-12">
        <div className="container">
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">
                  Trending This Week
                </h2>
                <p className="text-muted-foreground">
                  The most popular rules and patterns from the community
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href="/leaderboards">
                  View Leaderboards
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <Suspense fallback={<RuleListSkeleton count={6} />}>
              <RuleList initialFilters={{ sort: "trending" }} limit={6} />
            </Suspense>

            <div className="text-center">
              <Button asChild size="lg">
                <Link href="/rules?sort=trending">
                  View All Trending Rules
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 bg-muted/20">
        <div className="container">
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">
                Why Core Directory?
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Built by developers, for developers. Discover what makes our
                platform special.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <span>Curated Content</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Every rule is reviewed and tested by the community to ensure
                    quality and relevance for modern development practices.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Users className="h-5 w-5 text-primary" />
                    <span>Community Driven</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Built by developers who understand your challenges.
                    Contribute, vote, and help shape the future of development.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <span>Always Current</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Stay up-to-date with the latest patterns, frameworks, and
                    best practices as they emerge in the development community.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center space-y-8">
            <div className="space-y-4">
              <h2 className="text-3xl font-bold tracking-tight">
                Ready to contribute?
              </h2>
              <p className="text-xl text-muted-foreground">
                Share your knowledge and help other developers build better
                software.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg">
                <Link href="/submit">
                  Submit Your First Rule
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/authors">Meet the Community</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
