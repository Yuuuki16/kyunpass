"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Wave } from "@/components/Wave/Wave";
import { Header } from "@/components/header/Header";
import { Zen_Maru_Gothic } from "next/font/google";

const zenMaruGothic = Zen_Maru_Gothic({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

const QUESTION_DEFS = [
  {
    id: "duration",
    field: "period",
    group: "A",
    message: "出会ってからの期間",
  },
  {
    id: "situation",
    field: "meeting",
    group: "B",
    message: "出会った状況",
  },
  {
    id: "relationship",
    field: "relationship",
    group: "C",
    message: "今の関係性",
  },
] as const;

type QuestionId = (typeof QUESTION_DEFS)[number]["id"];
type ContextField = (typeof QUESTION_DEFS)[number]["field"];
type ContextGroup = (typeof QUESTION_DEFS)[number]["group"];

type ContextOption = { code: string; label: string };

type ContextOptionsResponse = Record<
  ContextGroup,
  Record<string, { label: string; coefficient: number }>
>;

type Question = {
  id: QuestionId;
  field: ContextField;
  message: string;
  options: ContextOption[];
};

type Answer = {
  questionId: QuestionId;
  code: string;
  label: string;
};

function buildQuestions(contextOptions: ContextOptionsResponse): Question[] {
  return QUESTION_DEFS.map((def) => ({
    id: def.id,
    field: def.field,
    message: def.message,
    options: Object.entries(contextOptions[def.group]).map(
      ([code, option]) => ({ code, label: option.label }),
    ),
  }));
}

export function Chatbot() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const firstOptionRef = useRef<HTMLButtonElement>(null);
  const shouldFocusFirstOptionRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/context-options`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load context options");
        }
        return response.json() as Promise<ContextOptionsResponse>;
      })
      .then((data) => {
        if (!cancelled) {
          setQuestions(buildQuestions(data));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!questions) return;

    chatEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });

    if (
      shouldFocusFirstOptionRef.current &&
      !isConfirmed &&
      answers.length < questions.length
    ) {
      firstOptionRef.current?.focus();
      shouldFocusFirstOptionRef.current = false;
    }
  }, [answers.length, isConfirmed, questions]);

  const handleAnswer = (questionId: QuestionId, option: ContextOption) => {
    if (!questions) return;

    setAnswers((currentAnswers) => {
      const currentQuestion = questions[currentAnswers.length];

      if (!currentQuestion || currentQuestion.id !== questionId) {
        return currentAnswers;
      }

      shouldFocusFirstOptionRef.current =
        currentAnswers.length + 1 < questions.length;

      return [
        ...currentAnswers,
        { questionId, code: option.code, label: option.label },
      ];
    });
  };

  const handleBack = (expectedAnswerCount: number) => {
    setIsConfirmed(false);
    setAnswers((currentAnswers) => {
      if (
        currentAnswers.length === 0 ||
        currentAnswers.length !== expectedAnswerCount
      ) {
        return currentAnswers;
      }

      shouldFocusFirstOptionRef.current = true;
      return currentAnswers.slice(0, -1);
    });
  };

  const handleConfirm = async () => {
    if (!questions || answers.length !== questions.length) return;

    setIsConfirmed(true);
    router.push("/loading");

    try {
      const talkHistory = sessionStorage.getItem("kyunpass:talkHistory") ?? "";
      const userName = sessionStorage.getItem("kyunpass:userName") ?? "";
      const otherName = sessionStorage.getItem("kyunpass:otherName") ?? "";

      const context = Object.fromEntries(
        questions.map((question) => [
          question.field,
          answers.find((answer) => answer.questionId === question.id)?.code ??
            "",
        ]),
      ) as Record<ContextField, string>;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/analyze`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_name: userName,
            other_name: otherName,
            context,
            talk_history: talkHistory,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string" ? data.detail : "分析に失敗しました",
        );
      }

      sessionStorage.setItem("kyunpass:kyunScore", String(data.kyun_score));
      sessionStorage.setItem(
        "kyunpass:evaluation",
        typeof data.evaluation === "string" ? data.evaluation : "",
      );
      sessionStorage.setItem(
        "kyunpass:timeline",
        Array.isArray(data.timeline) ? JSON.stringify(data.timeline) : "[]",
      );
      sessionStorage.setItem(
        "kyunpass:kyunMessages",
        Array.isArray(data.kyun_messages)
          ? JSON.stringify(data.kyun_messages)
          : "[]",
      );
      sessionStorage.setItem(
        "kyunpass:cautionMessages",
        Array.isArray(data.caution_messages)
          ? JSON.stringify(data.caution_messages)
          : "[]",
      );
      sessionStorage.setItem(
        "kyunpass:variables",
        data.variables && typeof data.variables === "object"
          ? JSON.stringify(data.variables)
          : "{}",
      );
      sessionStorage.setItem(
        "kyunpass:themeEvaluations",
        data.theme_evaluations && typeof data.theme_evaluations === "object"
          ? JSON.stringify(data.theme_evaluations)
          : "{}",
      );

      router.replace("/result");
    } catch (error) {
      sessionStorage.setItem(
        "kyunpass:errorMessage",
        error instanceof Error
          ? error.message
          : "分析に失敗しました。もう一度お試しください。",
      );
      router.replace("/");
    }
  };

  if (loadError) {
    return (
      <div
        className={`${zenMaruGothic.className} relative mx-auto min-h-dvh w-full max-w-[430px] overflow-hidden bg-[#F5F5F5]`}
      >
        <Header />
        <main className="relative z-10 flex justify-center pt-10">
          <section className="flex h-[500px] w-[calc(100%_-_52px)] max-w-[300px] flex-col items-center justify-center gap-4 rounded-lg bg-white px-5 text-center">
            <p className="text-[14px] leading-5 text-[#D4537E]">
              質問の読み込みに失敗しました。もう一度お試しください。
            </p>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="min-h-9 rounded-lg bg-[#D4537E] px-4 py-1.5 text-[14px] leading-5 text-white"
            >
              最初からやり直す
            </button>
          </section>
        </main>
      </div>
    );
  }

  if (!questions) {
    return (
      <div
        className={`${zenMaruGothic.className} relative mx-auto min-h-dvh w-full max-w-[430px] overflow-hidden bg-[#F5F5F5]`}
      >
        <Header />
        <main className="relative z-10 flex justify-center pt-10">
          <section className="flex h-[500px] w-[calc(100%_-_52px)] max-w-[300px] items-center justify-center rounded-lg bg-white">
            <p className="text-[14px] leading-5 text-[#D4537E]">
              読み込み中...
            </p>
          </section>
        </main>
      </div>
    );
  }

  const visibleQuestions = questions.slice(
    0,
    Math.min(answers.length + 1, questions.length),
  );

  return (
    <div
      className={`${zenMaruGothic.className} relative mx-auto min-h-dvh w-full max-w-[430px] overflow-hidden bg-[#F5F5F5]`}
    >
      <Header />

      <div
        className="pointer-events-none absolute -left-[9px] right-0 top-20 rotate-180 [&>img]:h-auto [&>img]:w-full"
        aria-hidden="true"
      >
        <Wave />
      </div>

      <div
        className="pointer-events-none absolute -right-[9px] bottom-0 left-0 top-[580px] flex flex-col [&>img]:h-auto [&>img]:w-full [&>img]:shrink-0"
        aria-hidden="true"
      >
        <Wave />
        <div className="-mt-px min-h-px flex-1 bg-[#FBCFE8]" />
      </div>

      <main className="relative z-10 flex justify-center pt-10">
        <section className="h-[500px] w-[calc(100%_-_52px)] max-w-[300px] rounded-lg bg-white">
          <h1 className="relative flex h-[60px] items-center justify-center rounded-lg bg-[#D4537E] text-[32px] leading-none font-bold text-white">
            背景調査
            <span className="absolute right-3 top-3 text-[20px] font-normal">
              {Math.min(answers.length + 1, questions.length)}/
              {questions.length}
            </span>
          </h1>

          <div
            className="h-[440px] overflow-y-auto px-5 py-6"
            aria-label="背景調査の質問"
            aria-live="polite"
          >
            <div className="flex flex-col gap-5">
              {visibleQuestions.map((question, index) => {
                const answer = answers[index];
                const isCurrentQuestion = index === answers.length;

                return (
                  <div key={question.id}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="w-fit min-w-0 rounded-lg bg-[#FBCFE8] px-3 py-2 text-[16px] leading-6 text-white">
                        {question.message}
                      </p>
                      {isCurrentQuestion && index > 0 && (
                        <button
                          type="button"
                          onClick={() => handleBack(index)}
                          className="mt-1 shrink-0 rounded-lg border border-[#FF99B4] bg-white px-4 py-2 text-[10px] leading-4 text-[#D4537E]"
                        >
                          前の質問に戻る
                        </button>
                      )}
                    </div>

                    {answer ? (
                      <p className="mt-3 ml-auto w-fit max-w-full rounded-lg bg-[#B5B5B5] px-3 py-2 text-[16px] leading-6 text-white">
                        {answer.label}
                      </p>
                    ) : (
                      isCurrentQuestion && (
                        <fieldset className="mt-3 flex flex-col gap-2">
                          <legend className="sr-only">
                            {question.message}の選択肢
                          </legend>
                          {question.options.map((option, optionIndex) => (
                            <button
                              key={option.code}
                              ref={
                                optionIndex === 0 ? firstOptionRef : undefined
                              }
                              type="button"
                              onClick={() => handleAnswer(question.id, option)}
                              className="min-h-9 rounded-lg border border-[#FF99B4] bg-white px-3 py-1.5 text-left text-[14px] leading-5 text-[#D4537E]"
                            >
                              {option.label}
                            </button>
                          ))}
                        </fieldset>
                      )
                    )}
                  </div>
                );
              })}
              {answers.length === questions.length &&
                (isConfirmed ? (
                  <p className="text-center text-[14px] leading-5 text-[#D4537E]">
                    回答を確定しました
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    <p className="text-center text-[14px] leading-5 text-[#D4537E]">
                      回答結果を確定しますか？
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleConfirm}
                        className="min-h-9 flex-1 rounded-lg bg-[#D4537E] px-3 py-1.5 text-[14px] leading-5 text-white"
                      >
                        確定
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBack(questions.length)}
                        className="min-h-9 flex-1 rounded-lg border border-[#FF99B4] bg-white px-2 py-1.5 text-[12px] leading-5 text-[#D4537E]"
                      >
                        前の質問に戻る
                      </button>
                    </div>
                  </div>
                ))}
              <div ref={chatEndRef} />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
