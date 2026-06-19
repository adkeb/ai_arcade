import { AuthForm } from "@/components/AuthForm";

type LoginPageProps = {
  searchParams?: Promise<{
    oauth_error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const oauthError = typeof params.oauth_error === "string" ? params.oauth_error : "";

  return (
    <div className="py-10">
      <AuthForm mode="login" oauthError={oauthError} />
    </div>
  );
}
