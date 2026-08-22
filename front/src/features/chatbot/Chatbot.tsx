"use client";

import { useEffect, useRef, useState } from "react";
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
    message: "出会ってからの期間",
    options: ["1週間未満", "1週間〜1か月", "1〜3か月", "3か月〜1年", "1年以上"],
  },
  {
    id: "situation",
    message: "出会った状況",
    options: [
      "友人・知人の紹介",
      "学校・大学・サークル",
      "バイト・職場",
      "SNS・オンライン",
      "趣味・イベント",
      "偶然",
    ],
  },
  {
    id: "relationship",
    message: "今の関係性",
    options: ["ほとんど面識がない", "知り合い", "友人", "恋人"],
  },
] as const;

type QuestionId = (typeof questions)[number]["id"];

type Answer = {
  questionId: QuestionId;
  label: string;
};

export function Chatbot() {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const firstOptionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });

    if (answers.length > 0 && answers.length < questions.length) {
      firstOptionRef.current?.focus();
    }
  }, [answers.length]);

  const handleAnswer = (questionId: QuestionId, label: string) => {
    setAnswers((currentAnswers) => {
      const currentQuestion = questions[currentAnswers.length];

      if (!currentQuestion || currentQuestion.id !== questionId) {
        return currentAnswers;
      }

      return [...currentAnswers, { questionId, label }];
    });
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
          <h1 className="flex h-[60px] items-center justify-center rounded-lg bg-[#D4537E] text-[32px] leading-none font-bold text-white">
            背景調査
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
                    <p className="mr-auto w-fit max-w-full rounded-lg bg-[#FBCFE8] px-3 py-2 text-[16px] leading-6 text-white">
                      {question.message}
                    </p>

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
                              key={option}
                              ref={
                                optionIndex === 0 ? firstOptionRef : undefined
                              }
                              type="button"
                              onClick={() => handleAnswer(question.id, option)}
                              className="min-h-9 rounded-lg border border-[#FF99B4] bg-white px-3 py-1.5 text-left text-[14px] leading-5 text-[#D4537E]"
                            >
                              {option}
                            </button>
                          ))}
                        </fieldset>
                      )
                    )}
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
