import React from 'react';
import { Modal, Button } from '../ui';
import { StatusPill } from '../status';
import { VERIFICATION_STATUS } from '../status/statusMaps';
import { isInstitutionRole, isOfficerRole } from '../../auth/routeAccess';

/**
 * In-app help. Contains only guidance about this application — no invented
 * helpline numbers or contact addresses.
 */
export const HelpDialog: React.FC<{ isOpen: boolean; onClose: () => void; role?: string }> = ({ isOpen, onClose, role }) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title="Help and status guide"
    maxWidth="lg"
    footer={
      <Button size="sm" onClick={onClose}>
        Close
      </Button>
    }
  >
    <div className="space-y-5">
      <section>
        <h3 className="mb-1 font-semibold text-ink">Using this workspace</h3>
        {isInstitutionRole(role) && (
          <ol className="list-decimal space-y-1 pl-5 text-ink-soft">
            <li>Create an application from <strong>New application</strong> and choose its category.</li>
            <li>Upload each document listed in the application's checklist (PDF, JPEG or PNG).</li>
            <li>Optionally run <strong>Self-check</strong> to see findings before you submit.</li>
            <li>Submit. The server checks that required documents are present before accepting the submission.</li>
            <li>If a deficiency letter is issued, respond by uploading corrected documents.</li>
          </ol>
        )}
        {isOfficerRole(role) && (
          <ol className="list-decimal space-y-1 pl-5 text-ink-soft">
            <li>Open a case from the <strong>Review queue</strong>.</li>
            <li>Select a finding to see its cited evidence highlighted in the document viewer.</li>
            <li>Record a disposition for each finding (accept, dismiss with reason, or request clarification).</li>
            <li>Issue a deficiency letter or record a decision. Decisions are always made by an authorised officer.</li>
          </ol>
        )}
        {!isInstitutionRole(role) && !isOfficerRole(role) && (
          <p className="text-ink-soft">
            Use the menu to reach the pages available to your role. Pages you are not permitted to open are not shown.
          </p>
        )}
      </section>

      <section>
        <h3 className="mb-2 font-semibold text-ink">What the verification statuses mean</h3>
        <dl className="divide-y divide-line-soft rounded border border-line">
          {Object.entries(VERIFICATION_STATUS).map(([value, d]) => (
            <div key={value} className="grid gap-1 px-3 py-2 sm:grid-cols-[210px_1fr]">
              <dt>
                <StatusPill domain="verification" value={value} />
              </dt>
              <dd className="text-ink-soft">{d.description}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-meta text-ink-faint">
          A source that could not be reached is never shown as verified. Risk bands and automated findings are decision
          support only.
        </p>
      </section>

      <section>
        <h3 className="mb-1 font-semibold text-ink">Getting support</h3>
        <p className="text-ink-soft">
          For account access, role changes or password resets, contact the OneCheck administrator for your deployment.
          When reporting a problem, include the request ID shown in the error message, if one is displayed.
        </p>
      </section>
    </div>
  </Modal>
);
