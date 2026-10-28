import React from 'react';
import { PageHeader } from '../../components/ui';
import { SyndicateGraphView } from '../../components/syndicate/SyndicateGraphView';
import { IntegrityAuditControl } from '../../components/audit/IntegrityAuditControl';

export const NetworkSyndicatePage: React.FC = () => {
  return (
    <div className="page py-6 space-y-6">
      <PageHeader
        title="Network Syndicate Visualization"
        description="Graph database topology uncovering organized institutional syndicate rings, multi-hop connections, and recycled faculty rosters across AICTE institutions."
        breadcrumbs={[{ label: 'Oversight' }, { label: 'Syndicate Network' }]}
      />

      {/* Interactive Cytoscape.js Syndicate Web */}
      <div className="h-[700px] w-full">
        <SyndicateGraphView />
      </div>

      {/* Bureau Director Cryptographic Integrity Audit Section */}
      <div className="pt-2">
        <IntegrityAuditControl />
      </div>
    </div>
  );
};
