import type { FileUIPart } from "ai";
import {
  ArrowUpIcon,
  CameraIcon,
  ImageIcon,
  PaperclipIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";
import {
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentMedia,
} from "@/components/ui/chat/attachment";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/inputs/input-group";
import { toImagePart } from "@/features/chat/composer/images";

type Props = {
  busy: boolean;
  onSend: (text: string, files: FileUIPart[]) => void;
  onStop: () => void;
};

/** Touch targets are 44 px on phones, compact from md up. */
const BTN = "size-11 md:size-8";
/** Photos per message: each one is sent as a base64 image. */
const MAX_PHOTOS = 6;

export function ChatInput({ busy, onSend, onStop }: Props) {
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<FileUIPart[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  /** Adds the images among `files`, up to the limit. Unreadable ones are skipped. */
  async function attach(files: File[]) {
    const images = files
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, MAX_PHOTOS - photos.length);
    if (!images.length) return;
    setLoading(true);
    const parts = await Promise.all(
      images.map((file) => toImagePart(file).catch(() => null)),
    );
    setPhotos((current) =>
      [...current, ...parts.filter((part) => part !== null)].slice(
        0,
        MAX_PHOTOS,
      ),
    );
    setLoading(false);
  }

  function submit() {
    if (busy || loading || (!text.trim() && !photos.length)) return;
    onSend(text.trim(), photos);
    setText("");
    setPhotos([]);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  function onPaste(e: ClipboardEvent) {
    const files = Array.from(e.clipboardData.files).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (files.length) {
      e.preventDefault();
      void attach(files);
    }
  }

  return (
    <div className="p-3 pb-[max(--spacing(3),env(safe-area-inset-bottom))]">
      <InputGroup className="rounded-xl border-2 border-foreground bg-surface shadow-none">
        {(photos.length > 0 || loading) && (
          <InputGroupAddon align="block-start" className="flex-wrap">
            {photos.map((photo, i) => (
              <Attachment key={i} size="xs" state="done">
                <AttachmentMedia variant="image">
                  <img src={photo.url} alt="" />
                </AttachmentMedia>
                <AttachmentActions>
                  <AttachmentAction
                    aria-label="Retirer la photo"
                    onClick={() =>
                      setPhotos((current) => current.filter((_, j) => j !== i))
                    }
                  >
                    <XIcon />
                  </AttachmentAction>
                </AttachmentActions>
              </Attachment>
            ))}
            {loading && (
              <Attachment size="xs" state="processing">
                <AttachmentMedia variant="icon">
                  <ImageIcon />
                </AttachmentMedia>
              </Attachment>
            )}
          </InputGroupAddon>
        )}
        <InputGroupTextarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          rows={1}
          placeholder="Une recette, une idée, des photos…"
          aria-label="Message"
          className="max-h-40 min-h-11 text-[15px] md:min-h-9"
        />
        <InputGroupAddon align="block-end" className="justify-between">
          <span className="flex">
            <InputGroupButton
              size="icon-sm"
              className={BTN}
              aria-label="Joindre des photos"
              disabled={photos.length >= MAX_PHOTOS}
              onClick={() => fileInput.current?.click()}
            >
              <PaperclipIcon />
            </InputGroupButton>
            {/* phones only: elsewhere `capture` is ignored and this would be a second file picker */}
            <InputGroupButton
              size="icon-sm"
              className={`${BTN} md:hidden`}
              aria-label="Prendre une photo"
              disabled={photos.length >= MAX_PHOTOS}
              onClick={() => cameraInput.current?.click()}
            >
              <CameraIcon />
            </InputGroupButton>
          </span>
          {busy ? (
            <InputGroupButton
              size="icon-sm"
              variant="default"
              className={BTN}
              aria-label="Arrêter"
              onClick={onStop}
            >
              <SquareIcon />
            </InputGroupButton>
          ) : (
            <InputGroupButton
              size="icon-sm"
              variant="default"
              className={BTN}
              aria-label="Envoyer"
              disabled={loading || (!text.trim() && !photos.length)}
              onClick={submit}
            >
              <ArrowUpIcon />
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void attach(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          void attach(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </div>
  );
}
