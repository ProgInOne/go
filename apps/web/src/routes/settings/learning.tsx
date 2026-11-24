import { HINT_POLICIES, type HintPolicy } from '@proginone/shared';
import { Checkbox, ErrorState, RadioGroup, Skeleton } from '@proginone/ui';
import { createFileRoute } from '@tanstack/react-router';
import { useId, type ReactNode } from 'react';
import { useSettings } from '../../api/queries.ts';
import { cardClass, pageTitleClass } from '../../app/layout.ts';
import { useSaveSetting } from '../../features/settings/useSaveSetting.ts';

export const Route = createFileRoute('/settings/learning')({
  component: LearningSettings,
});

const HINT_LABELS: Record<HintPolicy, { label: string; description: string }> = {
  standard: {
    label: '기본',
    description: '언제든 힌트를 한 단계씩 열 수 있어요. 정답은 힌트 3단계를 본 뒤에 볼 수 있어요.',
  },
  'after-attempt': {
    label: '먼저 풀어 보기',
    description:
      '한 번 답을 제출해 본 뒤에 힌트가 열려요. 스스로 떠올려 본 시도가 기억에 더 오래 남아요.',
  },
};

function Group({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className={`${cardClass} grid gap-4`} aria-labelledby={id}>
      <h2 id={id} className="type-h3 text-heading">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * 설정 > 학습 방식 (ui-ux.md#설정, FR-SET-02, D-047). Each change is saved at once and used by the
 * feature it controls: practice and inline checks (confidence, hints), the code editor
 * (autocomplete), lesson examples (predict first) and the relearning card (tutor suggestion).
 */
function LearningSettings() {
  const settings = useSettings();
  const { save, pending } = useSaveSetting();

  return (
    <section aria-labelledby="learning-title" className="max-w-[760px]">
      <h1 id="learning-title" className={pageTitleClass}>
        학습 방식
      </h1>
      {settings.isPending ? (
        <Skeleton height={320} />
      ) : settings.isError ? (
        <ErrorState
          variant="inline"
          title="설정을 불러오지 못했어요"
          description={settings.error.message}
        />
      ) : (
        <div className="grid gap-6">
          <Group title="문제 풀이">
            <Checkbox
              label="답을 낼 때 확신도 묻기"
              description="제출 버튼이 확실해요·애매해요·찍었어요로 나뉘어요. 확신했는데 틀린 문제를 골라 더 자세히 알려 줘요. 끄면 '제출' 하나만 보이고 확신도는 기록하지 않아요."
              checked={settings.data['practice.askConfidence']}
              disabled={pending}
              onCheckedChange={(checked) => {
                save({ 'practice.askConfidence': checked === true }, '확신도');
              }}
            />
            <RadioGroup
              legend="힌트 정책"
              value={settings.data['hints.policy']}
              disabled={pending}
              options={HINT_POLICIES.map((p) => ({ value: p, ...HINT_LABELS[p] }))}
              onValueChange={(value) => {
                save({ 'hints.policy': value as HintPolicy }, '힌트 정책');
              }}
            />
          </Group>

          <Group title="AI 튜터">
            <Checkbox
              label="튜터 선제 제안"
              description="같은 개념에서 계속 막히면 '튜터에게 물어볼 수도 있어요' 안내를 보여 줘요. 튜터 창을 저절로 열지는 않아요."
              checked={settings.data['tutor.proactiveSuggestions']}
              disabled={pending}
              onCheckedChange={(checked) => {
                save({ 'tutor.proactiveSuggestions': checked === true }, '튜터 선제 제안');
              }}
            />
          </Group>
        </div>
      )}
    </section>
  );
}
