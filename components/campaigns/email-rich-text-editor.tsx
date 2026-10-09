"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { Icon } from "@/components/ui/icon";
import {
  EMOJI_FREQUENTLY_USED,
  EMOJI_SMILEYS,
  MERGE_TAGS,
  SPINTAX_PRESETS,
  VARIABLE_TAGS,
} from "@/lib/campaigns/editor-constants";
import { plainTextToHtml } from "@/lib/email/html-body";
import { cn } from "@/lib/utils";

interface EmailRichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export type EmailRichTextEditorHandle = {
  insertText: (text: string) => void;
  openMergeTags: () => void;
  openSpintax: () => void;
};

type PopoverKind = "emoji" | "merge" | "spintax" | null;

export const EmailRichTextEditor = forwardRef<
  EmailRichTextEditorHandle,
  EmailRichTextEditorProps
>(function EmailRichTextEditor(
  { value, onChange, placeholder = "Write your email...", className },
  ref,
) {
  const [popover, setPopover] = useState<PopoverKind>(null);
  const [mergeTab, setMergeTab] = useState<"merge" | "variable">("merge");
  const [tagSearch, setTagSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ["paragraph"] }),
      Placeholder.configure({ placeholder }),
    ],
    content: plainTextToHtml(value),
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[260px] px-4 py-3 focus:outline-none text-body-sm text-on-surface",
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = plainTextToHtml(value);
    if (current !== next && value !== current) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [editor, value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setPopover(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function insertText(text: string) {
    if (!editor) return;
    editor.chain().focus().insertContent(text).run();
    setPopover(null);
    setTagSearch("");
  }

  useImperativeHandle(
    ref,
    () => ({
      insertText,
      openMergeTags: () => {
        setMergeTab("variable");
        setPopover("merge");
        setTagSearch("");
        editor?.chain().focus().run();
      },
      openSpintax: () => {
        setPopover("spintax");
        setTagSearch("");
        editor?.chain().focus().run();
      },
    }),
    [editor],
  );

  function togglePopover(kind: PopoverKind) {
    setPopover((prev) => (prev === kind ? null : kind));
    setTagSearch("");
  }

  const tags = mergeTab === "merge" ? MERGE_TAGS : VARIABLE_TAGS;
  const filteredTags = tags.filter(
    (t) =>
      t.label.toLowerCase().includes(tagSearch.toLowerCase()) ||
      t.tag.toLowerCase().includes(tagSearch.toLowerCase()),
  );

  if (!editor) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col rounded-md border border-outline-variant bg-surface-container-low overflow-hidden",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-0.5 border-b border-outline-variant bg-surface-container-lowest px-2 py-1.5">
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <span className="font-bold text-[13px]">B</span>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <span className="italic text-[13px]">I</span>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
        >
          <span className="underline text-[13px]">U</span>
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          title="Align left"
        >
          <Icon name="format_align_left" size={16} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          title="Align center"
        >
          <Icon name="format_align_center" size={16} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          title="Align right"
        >
          <Icon name="format_align_right" size={16} />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          <Icon name="format_list_bulleted" size={16} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
        >
          <Icon name="format_list_numbered" size={16} />
        </ToolbarButton>

        <ToolbarDivider />

        <ToolbarButton
          active={popover === "emoji"}
          onClick={() => togglePopover("emoji")}
          title="Emoji"
        >
          <Icon name="sentiment_satisfied" size={16} />
        </ToolbarButton>
        <ToolbarButton
          active={popover === "merge"}
          onClick={() => togglePopover("merge")}
          title="Merge tags"
        >
          <span className="text-[11px] font-mono font-semibold">{"{{}}"}</span>
        </ToolbarButton>
        <ToolbarButton
          active={popover === "spintax"}
          onClick={() => togglePopover("spintax")}
          title="Spintax"
        >
          <span className="text-[11px] font-mono font-semibold">{"{|}"}</span>
        </ToolbarButton>
      </div>

      <div className="relative flex-1 min-h-0 bg-surface-container-lowest">
        <EditorContent editor={editor} className="min-h-[260px]" />

        {popover === "emoji" && (
          <EditorPopover className="right-2 top-2 w-72 max-h-80 overflow-y-auto">
            <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide mb-2">
              Frequently Used
            </p>
            <div className="flex flex-wrap gap-1 mb-3">
              {EMOJI_FREQUENTLY_USED.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => insertText(emoji)}
                  className="h-8 w-8 rounded hover:bg-surface-container-high text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
            <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide mb-2">
              Smileys & People
            </p>
            <div className="grid grid-cols-8 gap-0.5">
              {EMOJI_SMILEYS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => insertText(emoji)}
                  className="h-8 w-8 rounded hover:bg-surface-container-high text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </EditorPopover>
        )}

        {popover === "merge" && (
          <EditorPopover className="right-2 top-2 w-64 max-h-80 flex flex-col">
            <div className="flex border-b border-outline-variant mb-2">
              <button
                type="button"
                onClick={() => setMergeTab("merge")}
                className={cn(
                  "flex-1 py-2 text-[12px] font-medium border-b-2 -mb-px",
                  mergeTab === "merge"
                    ? "text-primary border-primary"
                    : "text-on-surface-variant border-transparent",
                )}
              >
                Merge Tags
              </button>
              <button
                type="button"
                onClick={() => setMergeTab("variable")}
                className={cn(
                  "flex-1 py-2 text-[12px] font-medium border-b-2 -mb-px",
                  mergeTab === "variable"
                    ? "text-primary border-primary"
                    : "text-on-surface-variant border-transparent",
                )}
              >
                Variable Tags
              </button>
            </div>
            <div className="relative mb-2">
              <Icon
                name="search"
                size={14}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-on-surface-variant"
              />
              <input
                type="text"
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                placeholder="Search"
                className="w-full h-8 pl-7 pr-2 rounded bg-surface-container-low border border-outline-variant text-[12px]"
              />
            </div>
            <div className="overflow-y-auto flex-1 space-y-0.5">
              {filteredTags.map((item) => (
                <button
                  key={item.tag}
                  type="button"
                  onClick={() => insertText(item.tag)}
                  className="w-full text-left px-2 py-1.5 rounded text-[12px] hover:bg-surface-container-low text-on-surface"
                >
                  {item.tag}
                </button>
              ))}
            </div>
          </EditorPopover>
        )}

        {popover === "spintax" && (
          <EditorPopover className="right-2 top-2 w-72 max-h-80 overflow-y-auto">
            <button
              type="button"
              onClick={() => insertText("{Hi | Hello | Hey}")}
              className="text-[12px] text-primary font-medium mb-3 hover:underline"
            >
              + Insert new spintax
            </button>
            {SPINTAX_PRESETS.map((group) => (
              <div key={group.title} className="mb-4">
                <p className="text-[11px] font-semibold text-on-surface mb-1.5">{group.title}</p>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => insertText(item)}
                      className="w-full text-left px-2 py-1.5 rounded text-[12px] hover:bg-surface-container-low text-on-surface border border-transparent hover:border-outline-variant/60"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </EditorPopover>
        )}
      </div>
    </div>
  );
});

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "h-7 w-7 flex items-center justify-center rounded text-on-surface-variant hover:bg-surface-container-high transition-colors",
        active && "bg-primary/10 text-primary",
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <span className="w-px h-5 bg-outline-variant/60 mx-0.5" />;
}

function EditorPopover({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute z-20 rounded-lg border border-outline-variant bg-surface-container-lowest shadow-lg p-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function MergeTagPills({ onInsert }: { onInsert: (tag: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {MERGE_TAGS.map(({ tag }) => (
        <button
          key={tag}
          type="button"
          onClick={() => onInsert(tag)}
          className="h-7 px-2 rounded border border-outline-variant bg-surface-container-low text-[11px] font-mono hover:bg-surface-container-high transition-colors"
        >
          {tag}
        </button>
      ))}
    </div>
  );
}
