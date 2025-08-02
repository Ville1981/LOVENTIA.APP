// File: src/pages/MessagesOverview.jsx
import React from 'react';
import { Helmet } from 'react-helmet';
import ConversationList from '../components/ConversationList';
import { useTranslation } from 'react-i18next';

/**
 * MessagesOverview page
 *
 * Renders the conversation overview list within the main layout.
 */
export default function MessagesOverview() {
  const { t } = useTranslation();

  return (
    <main className="p-6">
      {/* SEO / document head */}
      <Helmet>
        <title>{t('chat.overview.title', 'Conversations')} - MyApp</title>
        <meta
          name="description"
          content={t('chat.overview.pageDescription', 'View and manage your conversations')}
        />
      </Helmet>

      <header className="mb-4">
        <h1 className="text-2xl font-bold">{t('chat.overview.title', 'Conversations')}</h1>
      </header>

      <ConversationList />
    </main>
  );
}
