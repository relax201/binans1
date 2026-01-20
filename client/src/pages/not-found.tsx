import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-16 w-16 text-muted-foreground mb-6" />
          <h1 className="text-4xl font-bold mb-2">404</h1>
          <h2 className="text-xl font-semibold mb-4">الصفحة غير موجودة</h2>
          <p className="text-muted-foreground mb-8">
            عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
          </p>
          <Button asChild>
            <Link href="/" data-testid="link-go-home">
              <Home className="h-4 w-4 ml-2" />
              العودة للرئيسية
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
