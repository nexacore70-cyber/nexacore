-- CreateTable
CREATE TABLE "TutorQuestion" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "choices" JSONB NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorAudioTask" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TutorAudioTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorAssessment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'KNOWLEDGE',
    "knowledgeStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "audioStartedAt" TIMESTAMP(3),
    "knowledgeScore" DOUBLE PRECISION,
    "audioScore" DOUBLE PRECISION,
    "finalScore" DOUBLE PRECISION,
    "passed" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorAssessmentQuestion" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "choices" JSONB NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "answerIndex" INTEGER,

    CONSTRAINT "TutorAssessmentQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorAssessmentAudio" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "answer" TEXT,
    "score" DOUBLE PRECISION,

    CONSTRAINT "TutorAssessmentAudio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorAssessmentIncident" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorAssessmentIncident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TutorQuestion_subject_approved_idx" ON "TutorQuestion"("subject", "approved");

-- CreateIndex
CREATE INDEX "TutorAudioTask_subject_approved_idx" ON "TutorAudioTask"("subject", "approved");

-- CreateIndex
CREATE INDEX "TutorAssessment_userId_createdAt_idx" ON "TutorAssessment"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TutorAssessmentQuestion_assessmentId_questionId_key" ON "TutorAssessmentQuestion"("assessmentId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "TutorAssessmentAudio_assessmentId_taskId_key" ON "TutorAssessmentAudio"("assessmentId", "taskId");

-- AddForeignKey
ALTER TABLE "TutorAssessment" ADD CONSTRAINT "TutorAssessment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorAssessmentQuestion" ADD CONSTRAINT "TutorAssessmentQuestion_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "TutorAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorAssessmentAudio" ADD CONSTRAINT "TutorAssessmentAudio_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "TutorAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorAssessmentIncident" ADD CONSTRAINT "TutorAssessmentIncident_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "TutorAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
