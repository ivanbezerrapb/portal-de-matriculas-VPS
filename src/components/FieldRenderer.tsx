import { useState } from "react";
import type { AddressEntry, ChildEntry, FormField } from "@/lib/ext/model";
import {
  MAX_CHILDREN,
  emptyChild,
  formatAddress,
  parseAddress,
  parseChildren,
  splitChildOptions,
} from "@/lib/ext/model";
import { Input, Label, Select, Textarea } from "./ui";

// Renderiza um campo do formulário. `value` é string ou string[] (múltipla escolha).
export function FieldRenderer({
  field,
  value,
  onChange,
  error,
}: {
  field: FormField;
  value: string | string[];
  onChange: (v: string | string[]) => void;
  error?: string | undefined;
}) {
  const strValue = typeof value === "string" ? value : "";
  const arrValue = Array.isArray(value) ? value : [];

  return (
    <div>
      <Label htmlFor={field.id}>
        {field.label}
        {field.required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {field.help_text && <p className="mb-1 text-xs text-muted-foreground">{field.help_text}</p>}

      {field.type === "short_text" && (
        <Input id={field.id} value={strValue} onChange={(e) => onChange(e.target.value)} />
      )}
      {field.type === "long_text" && (
        <Textarea
          id={field.id}
          rows={4}
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.type === "number" && (
        <Input
          id={field.id}
          type="number"
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.type === "date" && (
        <Input
          id={field.id}
          type="date"
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.type === "email" && (
        <Input
          id={field.id}
          type="email"
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.type === "phone" && (
        <Input
          id={field.id}
          type="tel"
          placeholder="(00) 00000-0000"
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.type === "yes_no" && (
        <div className="flex gap-3">
          {["Sim", "Não"].map((opt) => (
            <label
              key={opt}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm ${
                strValue === opt ? "border-primary bg-accent font-medium" : "border-input bg-card"
              }`}
            >
              <input
                type="radio"
                className="accent-[var(--color-primary)]"
                checked={strValue === opt}
                onChange={() => onChange(opt)}
              />
              {opt}
            </label>
          ))}
        </div>
      )}
      {field.type === "single_choice" && (
        <div className="flex flex-col gap-2">
          {(field.options ?? []).map((opt) => (
            <label
              key={opt}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                strValue === opt ? "border-primary bg-accent font-medium" : "border-input bg-card"
              }`}
            >
              <input
                type="radio"
                className="accent-[var(--color-primary)]"
                checked={strValue === opt}
                onChange={() => onChange(opt)}
              />
              {opt}
            </label>
          ))}
        </div>
      )}
      {field.type === "multiple_choice" && (
        <div className="flex flex-col gap-2">
          {(field.options ?? []).map((opt) => {
            const checked = arrValue.includes(opt);
            return (
              <label
                key={opt}
                className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                  checked ? "border-primary bg-accent font-medium" : "border-input bg-card"
                }`}
              >
                <input
                  type="checkbox"
                  className="accent-[var(--color-primary)]"
                  checked={checked}
                  onChange={() =>
                    onChange(checked ? arrValue.filter((v) => v !== opt) : [...arrValue, opt])
                  }
                />
                {opt}
              </label>
            );
          })}
        </div>
      )}

      {field.type === "children" && (
        <ChildrenField field={field} value={strValue} onChange={onChange} />
      )}

      {field.type === "address" && (
        <AddressField field={field} value={strValue} onChange={onChange} />
      )}

      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

// Bloco "N Filhos": quantidade + dados individuais de cada criança.
function ChildrenField({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: string;
  onChange: (v: string) => void;
}) {
  const children = parseChildren(value);
  const { series, turnos } = splitChildOptions(field.options);

  const commit = (list: ChildEntry[]) => onChange(list.length === 0 ? "" : JSON.stringify(list));

  const setCount = (count: number) => {
    if (count <= 0) return commit([]);
    const next = [...children];
    while (next.length < count) next.push(emptyChild());
    commit(next.slice(0, count));
  };

  const setChild = (index: number, patch: Partial<ChildEntry>) => {
    commit(children.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  return (
    <div className="flex flex-col gap-3">
      <Select
        className="w-48"
        value={children.length === 0 ? "" : String(children.length)}
        onChange={(e) => setCount(Number(e.target.value || 0))}
      >
        <option value="">Quantas crianças?</option>
        {Array.from({ length: MAX_CHILDREN }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            {n} {n === 1 ? "criança" : "crianças"}
          </option>
        ))}
      </Select>

      {children.map((child, i) => (
        <div key={i} className="rounded-md border border-input bg-card p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Criança {i + 1}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={`${field.id}-nome-${i}`}>Nome</Label>
              <Input
                id={`${field.id}-nome-${i}`}
                value={child.nome}
                onChange={(e) => setChild(i, { nome: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor={`${field.id}-nasc-${i}`}>Data de nascimento</Label>
              <Input
                id={`${field.id}-nasc-${i}`}
                type="date"
                value={child.nascimento}
                onChange={(e) => setChild(i, { nascimento: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor={`${field.id}-serie-${i}`}>Série</Label>
              <Select
                id={`${field.id}-serie-${i}`}
                value={child.serie}
                onChange={(e) => setChild(i, { serie: e.target.value })}
              >
                <option value="">Selecione...</option>
                {series.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor={`${field.id}-turno-${i}`}>Turno</Label>
              <Select
                id={`${field.id}-turno-${i}`}
                value={child.turno}
                onChange={(e) => setChild(i, { turno: e.target.value })}
              >
                <option value="">Selecione...</option>
                {turnos.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

function maskCep(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

// Bloco "Endereço": CEP busca automática (ViaCEP) + campos editáveis.
function AddressField({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: string;
  onChange: (v: string) => void;
}) {
  const address = parseAddress(value);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  const commit = (patch: Partial<AddressEntry>) =>
    onChange(JSON.stringify({ ...address, ...patch }));

  async function lookupCep(cep: string, current: AddressEntry) {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setStatus("loading");
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = (await res.json()) as Record<string, unknown>;
      if (data["erro"]) {
        setStatus("error");
        return;
      }
      setStatus("idle");
      onChange(
        JSON.stringify({
          ...current,
          rua: String(data["logradouro"] ?? current.rua),
          bairro: String(data["bairro"] ?? current.bairro),
          cidade: String(data["localidade"] ?? current.cidade),
          estado: String(data["uf"] ?? current.estado),
        }),
      );
      document.getElementById(`${field.id}-numero`)?.focus();
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-6">
      <div className="sm:col-span-2">
        <Label htmlFor={`${field.id}-cep`}>CEP</Label>
        <Input
          id={`${field.id}-cep`}
          inputMode="numeric"
          placeholder="00000-000"
          value={address.cep}
          onChange={(e) => {
            const cep = maskCep(e.target.value);
            const next = { ...address, cep };
            setStatus("idle");
            onChange(JSON.stringify(next));
            if (cep.replace(/\D/g, "").length === 8) void lookupCep(cep, next);
          }}
        />
        {status === "loading" && (
          <p className="mt-1 text-xs text-muted-foreground">Buscando CEP...</p>
        )}
        {status === "error" && (
          <p className="mt-1 text-xs text-muted-foreground">
            CEP não encontrado — preencha os campos manualmente.
          </p>
        )}
      </div>
      <div className="sm:col-span-3">
        <Label htmlFor={`${field.id}-rua`}>Rua</Label>
        <Input
          id={`${field.id}-rua`}
          value={address.rua}
          onChange={(e) => commit({ rua: e.target.value })}
        />
      </div>
      <div className="sm:col-span-1">
        <Label htmlFor={`${field.id}-numero`}>Número</Label>
        <Input
          id={`${field.id}-numero`}
          value={address.numero}
          onChange={(e) => commit({ numero: e.target.value })}
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={`${field.id}-complemento`}>Complemento (opcional)</Label>
        <Input
          id={`${field.id}-complemento`}
          value={address.complemento}
          onChange={(e) => commit({ complemento: e.target.value })}
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={`${field.id}-bairro`}>Bairro</Label>
        <Input
          id={`${field.id}-bairro`}
          value={address.bairro}
          onChange={(e) => commit({ bairro: e.target.value })}
        />
      </div>
      <div className="sm:col-span-1">
        <Label htmlFor={`${field.id}-cidade`}>Cidade</Label>
        <Input
          id={`${field.id}-cidade`}
          value={address.cidade}
          onChange={(e) => commit({ cidade: e.target.value })}
        />
      </div>
      <div className="sm:col-span-1">
        <Label htmlFor={`${field.id}-estado`}>Estado</Label>
        <Select
          id={`${field.id}-estado`}
          value={address.estado}
          onChange={(e) => commit({ estado: e.target.value })}
        >
          <option value="">UF</option>
          {UFS.map((uf) => (
            <option key={uf} value={uf}>
              {uf}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

function formatDateBR(raw: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw;
  const [y, m, d] = raw.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

// Formata um valor para exibição/impressão
export function formatValue(field: FormField, raw: string): string {
  if (!raw) return "—";
  if (field.type === "address") {
    return formatAddress(parseAddress(raw)) || "—";
  }
  if (field.type === "children") {
    const list = parseChildren(raw);
    if (list.length === 0) return "—";
    return list
      .map(
        (c, i) =>
          `${i + 1}. ${[c.nome || "—", formatDateBR(c.nascimento), c.serie, c.turno]
            .filter(Boolean)
            .join(" — ")}`,
      )
      .join("\n");
  }
  if (field.type === "multiple_choice") {
    try {
      const arr = JSON.parse(raw) as string[];
      return Array.isArray(arr) ? arr.join(", ") : raw;
    } catch {
      return raw;
    }
  }
  if (field.type === "date" && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const [y, m, d] = raw.slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
  }
  return raw;
}
