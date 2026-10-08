import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiteHeader } from '../../shared/site-header/site-header';

type IssueTone = 'danger' | 'warning' | 'info' | 'success';

type PreviewIssue = {
  key: string;
  title: string;
  status: string;
  tone: IssueTone;
};

type LandingFeature = {
  number: string;
  title: string;
  description: string;
};

type LandingPlan = {
  name: string;
  audience: string;
  description: string;
  features: string[];
  featured: boolean;
};

type LandingFaq = {
  question: string;
  answer: string;
};

@Component({
  selector: 'app-landing-page',
  imports: [RouterLink, SiteHeader],
  templateUrl: './landing-page.html',
  styleUrl: './landing-page.css',
})
export class LandingPage {
  protected readonly previewIssues: PreviewIssue[] = [
    { key: 'BUG-248', title: 'Checkout fails after refresh', status: 'Critical', tone: 'danger' },
    { key: 'BUG-251', title: 'Invite email arrives late', status: 'In progress', tone: 'warning' },
    { key: 'BUG-257', title: 'Add context to error reports', status: 'Open', tone: 'info' },
    { key: 'BUG-263', title: 'Profile update is verified', status: 'Resolved', tone: 'success' },
  ];

  protected readonly features: LandingFeature[] = [
    {
      number: '01',
      title: 'Capture the full picture',
      description:
        'Keep the report, reproduction notes, and discussion together so the next person has the context they need.',
    },
    {
      number: '02',
      title: 'Make the next step clear',
      description:
        'Give every issue a visible owner and status, making it easier to move from triage to a verified fix.',
    },
    {
      number: '03',
      title: 'Keep work connected',
      description:
        'Bring developers, QA, and product teammates into one shared view of what needs attention.',
    },
  ];

  protected readonly workflow = [
    {
      number: '01',
      title: 'Report',
      description: 'Capture an issue with enough detail to reproduce it.',
    },
    {
      number: '02',
      title: 'Triage',
      description: 'Agree on priority, ownership, and the right next action.',
    },
    {
      number: '03',
      title: 'Resolve',
      description: 'Track the fix through review and verification.',
    },
  ];

  protected readonly plans: LandingPlan[] = [
    {
      name: 'Starter',
      audience: 'For a focused start',
      description: 'Bring issue reports and their follow-up into one clear place.',
      features: [
        'Issue intake and status tracking',
        'A shared project view',
        'Clear ownership for follow-up',
      ],
      featured: false,
    },
    {
      name: 'Team',
      audience: 'For teams shipping together',
      description: 'Coordinate triage and keep day-to-day issue work visible.',
      features: [
        'Everything in Starter',
        'Team triage and prioritization',
        'Progress across active work',
      ],
      featured: true,
    },
    {
      name: 'Enterprise',
      audience: 'For cross-team workflows',
      description: 'Shape a connected issue workflow around a larger organization.',
      features: [
        'Cross-team coordination',
        'Flexible workflow setup',
        'Rollout needs discussed together',
      ],
      featured: false,
    },
  ];

  protected readonly faqs: LandingFaq[] = [
    {
      question: 'What is BUGConnect?',
      answer:
        'BUGConnect is an issue-tracking workspace for capturing, prioritizing, and following software bugs through resolution.',
    },
    {
      question: 'Who is it designed for?',
      answer:
        'It is designed to give product, engineering, and QA teammates a shared view of reported issues and their next steps.',
    },
    {
      question: 'Where can I see plan pricing?',
      answer:
        'The plan cards are a starting structure. Confirmed pricing and plan limits can be published here once they are finalized.',
    },
  ];
}
