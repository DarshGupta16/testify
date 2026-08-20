// Common & Dashboard Components
export { default as ImageLightboxModal } from './components/common/ImageLightboxModal.svelte';
export { default as MathRenderer } from './components/common/MathRenderer.svelte';
export { default as Toast } from './components/common/Toast.svelte';
export { default as EmptyState } from './components/dashboard/EmptyState.svelte';
export { default as FilterBar } from './components/dashboard/FilterBar.svelte';
export { default as StatsBar } from './components/dashboard/StatsBar.svelte';
export { default as TestCard } from './components/dashboard/TestCard.svelte';

// Exam Suite Components
export { default as ExamQuestionCard } from './components/exam/ExamQuestionCard.svelte';
export { default as ExamQuestionPalette } from './components/exam/ExamQuestionPalette.svelte';
export { default as ExamScorecardReview } from './components/exam/ExamScorecardReview.svelte';
export { default as ExamSessionRunner } from './components/exam/ExamSessionRunner.svelte';
export { default as ReviewQuestionCard } from './components/exam/ReviewQuestionCard.svelte';
export { default as SubmitConfirmModal } from './components/exam/SubmitConfirmModal.svelte';
export { default as TestOverviewHub } from './components/exam/TestOverviewHub.svelte';
export { default as DiagramsTab } from './components/exam/tabs/DiagramsTab.svelte';
export { default as PagesTab } from './components/exam/tabs/PagesTab.svelte';
export { default as QuestionsTab } from './components/exam/tabs/QuestionsTab.svelte';

// Form Components
export { default as AiProviderSelector } from './components/forms/AiProviderSelector.svelte';
export { default as PdfDropzone } from './components/forms/PdfDropzone.svelte';
export { default as TestUploadForm } from './components/forms/TestUploadForm.svelte';

// Layout & Modal Components
export { default as Header } from './components/layout/Header.svelte';
export { default as ApiKeysModal } from './components/modals/ApiKeysModal.svelte';
export { default as QuestionItemEditor } from './components/modals/edit/QuestionItemEditor.svelte';
export { default as QuestionListPalette } from './components/modals/edit/QuestionListPalette.svelte';
export { default as QuestionOptionsEditor } from './components/modals/edit/QuestionOptionsEditor.svelte';
export { default as TestMetadataEditForm } from './components/modals/edit/TestMetadataEditForm.svelte';
export { default as MasterPasswordModal } from './components/modals/MasterPasswordModal.svelte';
export { default as SubjectsModal } from './components/modals/SubjectsModal.svelte';
export { default as TestDetailsModal } from './components/modals/TestDetailsModal.svelte';
export { default as TestEditModal } from './components/modals/TestEditModal.svelte';
export { default as UploadModal } from './components/modals/UploadModal.svelte';

// PDF Components
export { default as ExtractionMetricsBar } from './components/pdf/ExtractionMetricsBar.svelte';
export { default as PageExtractionCard } from './components/pdf/PageExtractionCard.svelte';

// Data & Services
export * from './services/ai';
export * from './services/assessmentEvaluator';
export * from './services/crypto';
export * from './services/db';
export * from './services/pdf';
export * from './services/settings';
export * from './services/testUploader';

// Stores
export * from './stores/apiKeyStore.svelte';
export * from './stores/appContext.svelte';
export * from './stores/attemptStore.svelte';
export * from './stores/filterStore.svelte';
export * from './stores/modalStore.svelte';
export * from './stores/securityStore.svelte';
export * from './stores/subjectStore.svelte';
export * from './stores/testStore.svelte';
export * from './stores/themeStore.svelte';
export * from './stores/toastStore.svelte';

// Types & Utilities
export * from './types';
export * from './utils';
