<script lang="ts" setup>
import '#layers/shared/app/assets/css/cbt-maker.css'
import utilConcatPdfs from '#layers/shared/app/utils/utilConcatPdfs'
import {
  cropperOverlayDatasKey,
  downloadDataKey,
  instructionsDataKey,
  outputZipFileNameKey,
  overlaysPerQuestionDataKey,
  pagesImgDataKey,
  testConfigKey,
} from '#layers/shared/app/components/Cbt/Maker/keys'

useSeoMeta({
  title: 'Test Maker - PDF2CBT',
})

const pdfCropperPanelElem = useTemplateRef('pdfCropperPanel')

const migrateJsonData = useMigrateJsonData()

const jsonOutputData = shallowRef<CbtMakerJsonOutput>(
  migrateJsonData.getPdfCropperJsonOutputTemplate(),
)

const instructionsData = reactive<CbtMakerInternalInstructionsData>({
  testInstructions: {
    type: 'default',
    pages: [],
    declaration: '',
  },
  additionalData: {},
})

const pdfLoadingState = shallowReactive({
  isLoading: false,
  isLoaded: false,
})

const pagesImgData = reactive<PagesImgData>({})

const currentStep = shallowRef<number>(1)

const pdfFile = shallowRef<Uint8Array | null>(null)

const pdfFileSources = ref<{ name: string; file: File }[]>([])
const fileInputRef = useTemplateRef<HTMLInputElement>('fileInputRef')

const testConfig = reactive<PdfCropperJsonOutput['testConfig']>({
  pdfFileHash: '', // SHA-256 hash of pdf file
  additionalData: {},
})

// reactive Map of overlay datas keyed by id
// id = (section || subject) + SEPARATOR + queNum + SEPARATOR + imgNum
const cropperOverlayDatas = ref(new Map<string, PdfCroppedOverlayInternalData>())

// count of overlays per question using queId as key
const overlaysPerQuestionData = reactive<PdfCropperOverlaysPerQuestion>(new Map())

const outputZipFileName = shallowRef('pdf2cbt_cropperdata')

const dialogsState = shallowReactive({
  showEditExistingFiles: false,
  showGenerateOutput: false,
})

function onFilesSelected(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return

  const newSources: { name: string; file: File }[] = []
  for (const file of input.files) {
    if (!pdfFileSources.value.some(s => s.name === file.name)) {
      newSources.push({ name: file.name, file })
    }
  }
  if (newSources.length) {
    pdfFileSources.value = [...pdfFileSources.value, ...newSources]
  }
  input.value = ''
}

function removePdfFile(index: number) {
  pdfFileSources.value = pdfFileSources.value.filter((_, i) => i !== index)
}

function movePdfFileUp(index: number) {
  if (index === 0) return
  const arr = [...pdfFileSources.value];
  [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]]
  pdfFileSources.value = arr
}

function movePdfFileDown(index: number) {
  if (index === pdfFileSources.value.length - 1) return
  const arr = [...pdfFileSources.value];
  [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]]
  pdfFileSources.value = arr
}

async function processPdfFiles() {
  if (pdfFileSources.value.length === 0) return

  pdfLoadingState.isLoading = true
  testConfig.pdfFileHash = ''
  testConfig.additionalData = {}

  try {
    const fileBuffers = await Promise.all(
      pdfFileSources.value.map(s => s.file.arrayBuffer().then(b => new Uint8Array(b))),
    )

    const mergedPdf = await utilConcatPdfs(fileBuffers)
    if (!mergedPdf) throw new Error('Failed to merge PDFs')

    pdfFile.value = mergedPdf

    const names = pdfFileSources.value.map(s => {
      const parts = s.name.split('.')
      parts.pop()
      return parts.join('.')
    })
    outputZipFileName.value = names.join('_') || 'pdf2cbt_cropperdata'

    await nextTick()

    return pdfCropperPanelElem.value?.loadPdfFile()
  }
  catch (err) {
    pdfLoadingState.isLoading = false
    useErrorToast('Error processing PDF files:', err)
    return err
  }
}

async function loadExistingData(
  data: {
    pdfBuffer: Uint8Array
    jsonData: PdfCropperJsonOutput | AnswerKeyJsonOutputBasedOnPdfCropper
    filename: string
  },
) {
  try {
    if (!pdfCropperPanelElem.value)
      throw new Error('Pdf Cropper Panel Ref is undefined')

    pdfLoadingState.isLoading = true
    pdfFile.value = data.pdfBuffer
    pdfFileSources.value = [{ name: data.filename || 'questions.pdf', file: new File([data.pdfBuffer], data.filename || 'questions.pdf') }]

    await nextTick()

    await pdfCropperPanelElem.value.loadPdfFile()

    jsonOutputData.value = data.jsonData

    const { pdfFileHash, additionalData, testInstructions } = data.jsonData.testConfig ?? {}
    testConfig.pdfFileHash = pdfFileHash || ''

    if (testInstructions?.type) {
      instructionsData.testInstructions.type = testInstructions.type
    }

    for (const [subject, subjectData] of Object.entries(additionalData || {})) {
      for (const [section, sectionData] of Object.entries(subjectData.sections)) {
        if (sectionData.optionalQuestions || sectionData.instructions?.type) {
          instructionsData.additionalData[subject] = { sections: {} }

          instructionsData.additionalData[subject].sections[section] = {
            optionalQuestions: sectionData.optionalQuestions || 0,
            instructions: {
              type: sectionData.instructions?.type || 'none',
            },
          }
        }
      }
    }

    utilPdfCropperDataToInternalData(
      data.jsonData.pdfCropperData,
      pagesImgData,
      cropperOverlayDatas.value,
      overlaysPerQuestionData,
    )
    outputZipFileName.value = data.filename

    pdfLoadingState.isLoaded = true
  }
  catch (err) {
    useErrorToast('Error loading JSON Data of Existing files', err)
  }
}

const downloadData = computed(() => {
  return {
    pdfFile: pdfFile.value,
    jsonOutputData: jsonOutputData.value,
  }
})

function onBeforeUnloadCallback(e: Event) {
  e.preventDefault()
}

let removeNagivationGuard = () => {}

watch(() => pdfLoadingState.isLoaded,
  () => {
    window.addEventListener('beforeunload', onBeforeUnloadCallback)
    const router = useRouter()
    removeNagivationGuard = router.beforeEach((_, __, next) => {
      const confirmLeave = confirm(
        'Are you sure you want to leave Test Maker?\n'
        + 'Current test making progress may be lost if not saved/downloaded!',
      )
      if (confirmLeave) {
        next()
      }
      else {
        next(false)
      }
    })
  },
  { once: true },
)

const pageCleanUpCallback = () => {
  window.removeEventListener('beforeunload', onBeforeUnloadCallback)
  removeNagivationGuard()
}

onBeforeUnmount(pageCleanUpCallback)

provide(outputZipFileNameKey, outputZipFileName)
provide(downloadDataKey, downloadData)
provide(testConfigKey, testConfig)
provide(pagesImgDataKey, pagesImgData)
provide(cropperOverlayDatasKey, cropperOverlayDatas)
provide(overlaysPerQuestionDataKey, overlaysPerQuestionData)
provide(instructionsDataKey, instructionsData)
</script>

<template>
  <div class="flex flex-col grow min-h-0">
    <CbtMakerPdfCropper
      v-show="currentStep === 1"
      ref="pdfCropperPanel"
      v-model:current-step="currentStep"
      v-model:pdf-loading-state="pdfLoadingState"
      v-model:cropper-overlay-datas="cropperOverlayDatas"
      v-model:overlays-per-question-data="overlaysPerQuestionData"
      v-model:page-img-data="pagesImgData"
      :pdf-file="pdfFile"
    >
      <div class="flex flex-col gap-6 justify-center py-6 h-full">
        <template v-if="pdfFileSources.length === 0">
          <div class="flex gap-5 items-center justify-center">
            <input
              ref="fileInputRef"
              type="file"
              accept=".pdf"
              multiple
              class="hidden"
              @change="onFilesSelected"
            >
            <BaseButton
              label="Select PDFs"
              icon-name="line-md:plus"
              @click="fileInputRef?.click()"
            />
            <BaseButton
              label="Load Existing Data"
              variant="warn"
              @click="dialogsState.showEditExistingFiles = true"
            />
          </div>
          <DocsCbtMaker class="mx-4 sm:mx-10" />
        </template>
        <div
          v-else
          class="flex flex-col items-center gap-4 mx-auto w-full max-w-lg"
        >
          <div class="w-full border rounded-xl">
            <div
              v-for="(src, i) in pdfFileSources"
              :key="i"
              class="flex items-center gap-1 px-4 py-2 border-b last:border-b-0"
            >
              <span class="text-sm font-medium truncate grow order-1 md:order-none">{{ src.name }}</span>
              <div class="flex gap-0">
                <BaseButton
                  variant="ghost"
                  size="icon"
                  class="size-7!"
                  icon-name="line-md:arrow-up"
                  :class="i === 0 ? 'opacity-20 pointer-events-none' : ''"
                  @click="movePdfFileUp(i)"
                />
                <BaseButton
                  variant="ghost"
                  size="icon"
                  class="size-7!"
                  icon-name="line-md:arrow-down"
                  :class="i === pdfFileSources.length - 1 ? 'opacity-20 pointer-events-none' : ''"
                  @click="movePdfFileDown(i)"
                />
              </div>
              <span class="text-xs text-muted-foreground order-2 md:order-none whitespace-nowrap">#{{ i + 1 }}</span>
              <BaseButton
                variant="ghost"
                size="icon"
                class="size-7!"
                icon-class="text-red-500"
                icon-name="material-symbols:cancel-outline-rounded"
                @click="removePdfFile(i)"
              />
            </div>
          </div>
          <div class="flex gap-3">
            <BaseButton
              label="Add More"
              icon-name="line-md:plus"
              variant="outline"
              @click="fileInputRef?.click()"
            />
            <BaseButton
              :label="pdfLoadingState.isLoading ? 'Processing...' : 'Upload & Process'"
              :disabled="pdfLoadingState.isLoading"
              :icon-name="pdfLoadingState.isLoading ? 'line-md:loading-twotone-loop' : 'line-md:upload'"
              @click="processPdfFiles"
            />
            <BaseButton
              label="Clear All"
              variant="destructive"
              :disabled="pdfLoadingState.isLoading"
              @click="pdfFileSources = []"
            />
          </div>
        </div>
      </div>
    </CbtMakerPdfCropper>
    <LazyCbtMakerPostCropper
      v-if="pdfLoadingState.isLoaded"
      v-show="currentStep !== 1"
      v-model="currentStep"
    />
    <LazyCbtMakerPdfCropperEditExistingFilesDialog
      v-if="dialogsState.showEditExistingFiles"
      v-model="dialogsState.showEditExistingFiles"
      @uploaded-data="loadExistingData"
    />
  </div>
</template>
