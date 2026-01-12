import {
  component$,
  HTMLAttributes,
  Signal,
  useSignal,
  $,
  PropFunction,
} from "@builder.io/qwik";
import { useGenerateForm, FormField } from "~/neurify/ai/generate-component";
import { AIGenerating } from "~/neurify/components/AIGenerating";

interface AIFormProps
  extends Omit<HTMLAttributes<HTMLFormElement>, "onSubmit$"> {
  intent: string;
  data: Signal<any>;
  cacheTTL?: number;
  onSubmit$?: PropFunction<(formData: Record<string, any>) => void>;
  onCancel$?: PropFunction<() => void>;
}

export const AIForm = component$<AIFormProps>(
  ({
    intent,
    data,
    cacheTTL,
    onSubmit$,
    onCancel$,
    class: className,
    ...rest
  }) => {
    const { generating, error, formConfig } = useGenerateForm(
      intent,
      data,
      cacheTTL,
    );
    const formData = useSignal<Record<string, any>>({});
    const validationErrors = useSignal<Record<string, string>>({});

    const handleSubmit = $(async (e: Event) => {
      e.preventDefault();
      e.stopPropagation();

      // Validate form
      const errors: Record<string, string> = {};
      const config = formConfig.value;

      if (!config) return;

      for (const field of config.fields) {
        const value = formData.value[field.name];

        // Required validation
        if (field.required && (!value || value === "")) {
          errors[field.name] = `${field.label} is required`;
          continue;
        }

        // Skip other validations if field is empty and not required
        if (!value) continue;

        // Pattern validation
        if (field.validation?.pattern) {
          const regex = new RegExp(field.validation.pattern);
          if (!regex.test(value)) {
            errors[field.name] = `${field.label} format is invalid`;
          }
        }

        // Min/Max validation for numbers
        if (field.type === "number" && field.validation) {
          const numValue = Number(value);
          if (
            field.validation.min !== undefined &&
            numValue < field.validation.min
          ) {
            errors[field.name] =
              `${field.label} must be at least ${field.validation.min}`;
          }
          if (
            field.validation.max !== undefined &&
            numValue > field.validation.max
          ) {
            errors[field.name] =
              `${field.label} must be at most ${field.validation.max}`;
          }
        }

        // Length validation for text
        if (
          (field.type === "text" || field.type === "textarea") &&
          field.validation
        ) {
          const strValue = String(value);
          if (
            field.validation.minLength &&
            strValue.length < field.validation.minLength
          ) {
            errors[field.name] =
              `${field.label} must be at least ${field.validation.minLength} characters`;
          }
          if (
            field.validation.maxLength &&
            strValue.length > field.validation.maxLength
          ) {
            errors[field.name] =
              `${field.label} must be at most ${field.validation.maxLength} characters`;
          }
        }
      }

      validationErrors.value = errors;

      // If no errors, submit
      if (Object.keys(errors).length === 0 && onSubmit$) {
        await onSubmit$(formData.value);
      }
    });

    const handleCancel = $(async () => {
      if (onCancel$) {
        await onCancel$();
      }
    });

    const renderField = (field: FormField) => {
      const commonProps = {
        id: field.name,
        name: field.name,
        required: field.required,
        class:
          "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
        "aria-describedby": field.description
          ? `${field.name}-desc`
          : undefined,
      };

      const handleChange = $((e: Event) => {
        const target = e.target as HTMLInputElement;
        const value =
          target.type === "checkbox" ? target.checked : target.value;
        formData.value = { ...formData.value, [field.name]: value };

        // Clear validation error on change
        if (validationErrors.value[field.name]) {
          const newErrors = { ...validationErrors.value };
          delete newErrors[field.name];
          validationErrors.value = newErrors;
        }
      });

      switch (field.type) {
        case "textarea":
          return (
            <textarea
              {...commonProps}
              placeholder={field.placeholder}
              value={formData.value[field.name] || field.defaultValue || ""}
              onChange$={handleChange}
              rows={4}
            />
          );

        case "select":
          return (
            <select
              {...commonProps}
              value={formData.value[field.name] || field.defaultValue || ""}
              onChange$={handleChange}
            >
              <option value="">Select an option</option>
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          );

        case "checkbox":
          return (
            <input
              {...commonProps}
              type="checkbox"
              checked={
                formData.value[field.name] || field.defaultValue || false
              }
              onChange$={handleChange}
              class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          );

        case "radio":
          return (
            <div class="space-y-2">
              {field.options?.map((opt) => (
                <label key={opt.value} class="flex items-center space-x-2">
                  <input
                    type="radio"
                    name={field.name}
                    value={opt.value}
                    checked={formData.value[field.name] === opt.value}
                    onChange$={handleChange}
                    class="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          );

        default:
          return (
            <input
              {...commonProps}
              type={field.type}
              placeholder={field.placeholder}
              value={formData.value[field.name] || field.defaultValue || ""}
              onChange$={handleChange}
              min={field.validation?.min}
              max={field.validation?.max}
              minLength={field.validation?.minLength}
              maxLength={field.validation?.maxLength}
              pattern={field.validation?.pattern}
            />
          );
      }
    };

    if (generating.value) {
      return <AIGenerating />;
    }

    if (error.value) {
      return (
        <div class="rounded border border-red-300 p-4 text-red-500">
          Error generating form: {error.value}
        </div>
      );
    }

    if (!formConfig.value) {
      return null;
    }

    const config = formConfig.value;
    const layoutClass =
      config.layout === "grid"
        ? "grid grid-cols-1 md:grid-cols-2 gap-4"
        : config.layout === "horizontal"
          ? "flex flex-wrap gap-4"
          : "space-y-4";

    return (
      <form
        preventdefault:submit
        onSubmit$={handleSubmit}
        class={`${className || ""}`}
        {...rest}
      >
        {config.title && (
          <h2 class="mb-2 text-2xl font-bold">{config.title}</h2>
        )}

        {config.description && (
          <p class="mb-6 text-gray-600">{config.description}</p>
        )}

        <div class={layoutClass}>
          {config.fields.map((field) => (
            <div key={field.name} class="flex flex-col">
              <label
                for={field.name}
                class="mb-1 flex items-center font-medium"
              >
                {field.label}
                {field.required && <span class="ml-1 text-red-500">*</span>}
              </label>

              {renderField(field)}

              {field.description && (
                <p id={`${field.name}-desc`} class="mt-1 text-sm text-gray-500">
                  {field.description}
                </p>
              )}

              {validationErrors.value[field.name] && (
                <p class="mt-1 text-sm text-red-500">
                  {validationErrors.value[field.name]}
                </p>
              )}
            </div>
          ))}
        </div>

        <div class="mt-6 flex gap-3">
          <button
            type="submit"
            class="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            {config.submitLabel}
          </button>

          {config.cancelLabel && onCancel$ && (
            <button
              type="button"
              onClick$={handleCancel}
              class="rounded-md bg-gray-200 px-4 py-2 text-gray-800 hover:bg-gray-300 focus:ring-2 focus:ring-gray-400 focus:outline-none"
            >
              {config.cancelLabel}
            </button>
          )}
        </div>
      </form>
    );
  },
);
