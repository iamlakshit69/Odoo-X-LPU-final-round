import type { Lead, LeadDetail } from '../crm.js';

export const fixtureLeads: Lead[] = [
  {
    id: '40000000-0000-0000-0000-000000000001',
    name: 'Vikram Seth',
    phone: '+919811223344',
    email: 'vikram.seth@example.com',
    source: 'web_form',
    interest: 'Tennis coaching and Gold membership',
    stage: 'new',
    assignedTo: '00000000-0000-0000-0000-000000000003',
    assignedToName: 'Sunita Rao',
    createdAt: '2026-11-21T08:00:00Z',
  },
  {
    id: '40000000-0000-0000-0000-000000000002',
    name: 'Meera Kapoor',
    phone: '+919844556677',
    email: 'meera.k@gmail.com',
    source: 'trial_booking',
    interest: 'Padel weekend court booking',
    stage: 'contacted',
    assignedTo: '00000000-0000-0000-0000-000000000003',
    assignedToName: 'Sunita Rao',
    trialBookingId: '21000000-0000-0000-0000-000000000015',
    createdAt: '2026-11-20T14:30:00Z',
  },
  {
    id: '40000000-0000-0000-0000-000000000003',
    name: 'Rohan Deshmukh',
    phone: '+919877889900',
    email: 'rdeshmukh@techcorp.in',
    source: 'referral',
    interest: 'Corporate family badminton package',
    stage: 'quotation_sent',
    assignedTo: '00000000-0000-0000-0000-000000000001',
    assignedToName: 'Rajesh Khanna',
    createdAt: '2026-11-18T10:00:00Z',
  },
];

export const fixtureLeadDetail: LeadDetail = {
  ...fixtureLeads[0],
  activities: [
    {
      id: '41000000-0000-0000-0000-000000000001',
      leadId: fixtureLeads[0].id,
      type: 'message',
      body: 'Web enquiry received: Interested in tennis coaching for two children and Gold membership.',
      at: '2026-11-21T08:00:00Z',
    },
    {
      id: '41000000-0000-0000-0000-000000000002',
      leadId: fixtureLeads[0].id,
      type: 'call',
      body: 'Called Vikram. He will visit the club this evening at 17:30 to see the courts.',
      byUserId: '00000000-0000-0000-0000-000000000003',
      byUserName: 'Sunita Rao',
      at: '2026-11-21T09:30:00Z',
    },
  ],
  tasks: [
    {
      id: '42000000-0000-0000-0000-000000000001',
      leadId: fixtureLeads[0].id,
      title: 'Facility tour and welcome meeting at front desk',
      dueOn: '2026-11-21',
      doneAt: null,
      assignedTo: '00000000-0000-0000-0000-000000000003',
      assignedToName: 'Sunita Rao',
      createdAt: '2026-11-21T09:35:00Z',
    },
  ],
  quotes: [
    {
      id: '43000000-0000-0000-0000-000000000001',
      leadId: fixtureLeads[0].id,
      number: 'QTE-2026-00001',
      status: 'draft',
      validUntil: '2026-12-05',
      totalPaise: 8000000, // ₹80,000.00
      lines: [
        {
          description: 'Gold Championship Annual Membership',
          qty: 1,
          unitPricePaise: 5000000,
        },
        {
          description: 'Junior Academy Trainee Annual (x2)',
          qty: 2,
          unitPricePaise: 1500000,
        },
      ],
      createdAt: '2026-11-21T10:00:00Z',
    },
  ],
};
