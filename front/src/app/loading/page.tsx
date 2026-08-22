import { Loading } from "@/features/loading/Loading";

type LoadingPageProps = {
  searchParams: Promise<{ complete?: string | string[] }>;
};

export default async function Page({ searchParams }: LoadingPageProps) {
  const { complete } = await searchParams;

  return <Loading isComplete={complete === "1"} />;
}
