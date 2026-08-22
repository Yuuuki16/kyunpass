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

const questions = [
  {
    id: "duration",
    field: "period",
    message: "出会ってからの期間",
    options: [
      { code: "A1", label: "1週間未満" },
      { code: "A2", label: "1週間〜1か月" },
      { code: "A3", label: "1〜3か月" },
      { code: "A4", label: "3か月〜1年" },
      { code: "A5", label: "1年以上" },
    ],
  },
  {
    id: "situation",
    field: "meeting",
    message: "出会った状況",
    options: [
      { code: "B1", label: "友人・知人の紹介" },
      { code: "B2", label: "学校・大学・サークル" },
      { code: "B3", label: "バイト・職場" },
      { code: "B4", label: "SNS・オンライン" },
      { code: "B5", label: "趣味・イベント" },
      { code: "B6", label: "偶然" },
    ],
  },
  {
    id: "relationship",
    field: "relationship",
    message: "今の関係性",
    options: [
      { code: "C1", label: "ほとんど面識がない" },
      { code: "C2", label: "知り合い" },
      { code: "C3", label: "友人" },
      { code: "C4", label: "恋人" },
    ],
  },
] as const;

type QuestionId = (typeof questions)[number]["id"];

type Answer = {
  questionId: QuestionId;
  code: string;
  label: string;
};

export function Chatbot() {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const firstOptionRef = useRef<HTMLButtonElement>(null);
  const shouldFocusFirstOptionRef = useRef(false);

  useEffect(() => {
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
  }, [answers.length, isConfirmed]);

  const handleAnswer = (
    questionId: QuestionId,
    option: { code: string; label: string },
  ) => {
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
    if (answers.length !== questions.length) return;

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
      ) as { period: string; meeting: string; relationship: string };

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

      router.push("/result");
    } catch (error) {
      sessionStorage.setItem(
        "kyunpass:errorMessage",
        error instanceof Error
          ? error.message
          : "分析に失敗しました。もう一度お試しください。",
      );
      router.push("/");
    }
  };

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
