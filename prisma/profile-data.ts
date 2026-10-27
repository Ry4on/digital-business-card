import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface ProfileData {
  name: string;
  description: string;
  links: { label: string; url: string }[];
  skills: string[];
  experience: {
    company: string;
    position: string;
    startDate: string;
    endDate: string | null;
    achievements: string[];
  }[];
  projects: { name: string; description: string; url: string }[];
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value.trim();
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${path} must be a non-empty array`);
  }
  return value;
}

function httpUrl(value: unknown, path: string): string {
  const input = text(value, path);
  try {
    const url = new URL(input);
    if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return input;
  } catch { /* The error below identifies the data field without echoing its value. */ }
  throw new Error(`${path} must be an HTTP(S) URL without credentials`);
}

function date(value: unknown, path: string): string {
  const input = text(value, path);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) throw new Error(`${path} must be YYYY-MM-DD`);
  const parsed = new Date(`${input}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== input) {
    throw new Error(`${path} must be a valid calendar date`);
  }
  return input;
}

function unique(values: string[], path: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${path} contains duplicates`);
}

export function parseProfileData(value: unknown): ProfileData {
  const input = object(value, 'profile');
  const skills = array(input.skills, 'skills').map((v, i) => text(v, `skills[${i}]`));
  const links = array(input.links, 'links').map((v, i) => {
    const item = object(v, `links[${i}]`);
    return { label: text(item.label, `links[${i}].label`), url: httpUrl(item.url, `links[${i}].url`) };
  });
  const projects = array(input.projects, 'projects').map((v, i) => {
    const item = object(v, `projects[${i}]`);
    return {
      name: text(item.name, `projects[${i}].name`),
      description: text(item.description, `projects[${i}].description`),
      url: httpUrl(item.url, `projects[${i}].url`),
    };
  });
  const experience = array(input.experience, 'experience').map((v, i) => {
    const item = object(v, `experience[${i}]`);
    const startDate = date(item.startDate, `experience[${i}].startDate`);
    const endDate = item.endDate === null ? null : date(item.endDate, `experience[${i}].endDate`);
    if (endDate !== null && endDate < startDate) throw new Error(`experience[${i}] ends before it starts`);
    return {
      company: text(item.company, `experience[${i}].company`),
      position: text(item.position, `experience[${i}].position`),
      startDate,
      endDate,
      achievements: array(item.achievements, `experience[${i}].achievements`)
        .map((a, j) => text(a, `experience[${i}].achievements[${j}]`)),
    };
  });
  unique(skills, 'skills');
  unique(links.map(v => v.label), 'links');
  unique(projects.map(v => v.name), 'projects');
  unique(experience.map(v => `${v.company}:${v.position}:${v.startDate}`), 'experience');
  return {
    name: text(input.name, 'name'),
    description: text(input.description, 'description'),
    links, skills, experience, projects,
  };
}

export function loadProfileData(): ProfileData {
  return parseProfileData(JSON.parse(readFileSync(resolve('data/profile.json'), 'utf8')) as unknown);
}
