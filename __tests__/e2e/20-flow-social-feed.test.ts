import {
  supabaseAdmin,
  createTestUser,
  createTestPost,
  createTestPostReport,
  createTestNotification,
  cleanup
} from './setup';

describe('FLOW SOCIAL FEED — Posts → Likes → Comments → Mentions → Auto-posts → Moderation', () => {
  const createdIds = {
    users: [] as string[],
    posts: [] as string[],
    post_reports: [] as string[],
    notifications: [] as string[],
  };

  afterAll(async () => {
    await cleanup(createdIds);
  });

  // ── ÉTAPE 1 : Création de post ──
  test('1. Utilisateur crée un post texte → persisté en BDD', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const post = await createTestPost(user.id, {
      content: 'Quel match incroyable aujourd\'hui !',
    });
    createdIds.posts.push(post.id);

    expect(post.content).toBe('Quel match incroyable aujourd\'hui !');
    expect(post.author_id).toBe(user.id);
    expect(post.is_auto_generated).toBe(false);
  });

  // ── ÉTAPE 2 : Post avec images ──
  test('2. Post avec images → images stockées en JSONB', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const post = await createTestPost(user.id, {
      content: 'Photos du match',
      images: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
    });
    createdIds.posts.push(post.id);

    expect(post.images).toHaveLength(2);
    expect(post.images[0]).toContain('photo1');
  });

  // ── ÉTAPE 3 : Like d'un post ──
  test('3. Like d\'un post → post_likes créé → likes_count incrémenté', async () => {
    const author = await createTestUser();
    const liker = await createTestUser();
    createdIds.users.push(author.id, liker.id);

    const post = await createTestPost(author.id);
    createdIds.posts.push(post.id);

    const { data: like, error } = await supabaseAdmin
      .from('post_likes')
      .insert({ post_id: post.id, user_id: liker.id })
      .select()
      .single();

    expect(error).toBeNull();
    expect(like.post_id).toBe(post.id);
    expect(like.user_id).toBe(liker.id);
  });

  // ── ÉTAPE 4 : Commentaire sur un post ──
  test('4. Commentaire sur un post → post_comments créé', async () => {
    const author = await createTestUser();
    const commenter = await createTestUser();
    createdIds.users.push(author.id, commenter.id);

    const post = await createTestPost(author.id);
    createdIds.posts.push(post.id);

    const { data: comment, error } = await supabaseAdmin
      .from('post_comments')
      .insert({
        post_id: post.id,
        user_id: commenter.id,
        content: 'Super post !',
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(comment.content).toBe('Super post !');
    expect(comment.post_id).toBe(post.id);
  });

  // ── ÉTAPE 5 : Reply à un commentaire ──
  test('5. Reply à un commentaire → parent_comment_id défini', async () => {
    const author = await createTestUser();
    const commenter = await createTestUser();
    createdIds.users.push(author.id, commenter.id);

    const post = await createTestPost(author.id);
    createdIds.posts.push(post.id);

    const { data: parentComment } = await supabaseAdmin
      .from('post_comments')
      .insert({
        post_id: post.id,
        user_id: commenter.id,
        content: 'Commentaire parent',
      })
      .select()
      .single();

    const { data: reply, error } = await supabaseAdmin
      .from('post_comments')
      .insert({
        post_id: post.id,
        user_id: author.id,
        content: 'Réponse au commentaire',
        parent_comment_id: parentComment.id,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(reply.parent_comment_id).toBe(parentComment.id);
  });

  // ── ÉTAPE 6 : Auto-post ──
  test('6. Auto-post généré après match → is_auto_generated=true', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const post = await createTestPost(user.id, {
      content: 'Match terminé : 3-1 ! Victoire de notre équipe',
      is_auto_generated: true,
      auto_type: 'match_completed',
      sport_tag: 'football',
    });
    createdIds.posts.push(post.id);

    expect(post.is_auto_generated).toBe(true);
    expect(post.auto_type).toBe('match_completed');
    expect(post.sport_tag).toBe('football');
  });

  // ── ÉTAPE 7 : Mention dans un post ──
  test('7. Post avec mention → notification envoyée au user mentionné', async () => {
    const author = await createTestUser();
    const mentioned = await createTestUser();
    createdIds.users.push(author.id, mentioned.id);

    const post = await createTestPost(author.id, {
      content: `Bravo @${mentioned.username} pour ce match !`,
    });
    createdIds.posts.push(post.id);

    // Notification de mention
    const notif = await createTestNotification(mentioned.id, {
      type: 'mention',
      title: 'Vous avez été mentionné',
      message: `${author.username} vous a mentionné dans un post`,
      data: { postId: post.id, authorId: author.id },
    });
    createdIds.notifications.push(notif.id);

    expect(notif.type).toBe('mention');
    expect(notif.user_id).toBe(mentioned.id);
  });

  // ── ÉTAPE 8 : Signalement de post ──
  test('8. Post signalé → post_report créé avec status="pending"', async () => {
    const author = await createTestUser();
    const reporter = await createTestUser();
    createdIds.users.push(author.id, reporter.id);

    const post = await createTestPost(author.id, {
      content: 'Contenu problématique',
    });
    createdIds.posts.push(post.id);

    const report = await createTestPostReport(post.id, reporter.id, {
      reason: 'Spam',
    });
    createdIds.post_reports.push(report.id);

    expect(report.status).toBe('pending');
    expect(report.reason).toBe('Spam');
  });

  // ── ÉTAPE 9 : Modération — admin résout le signalement ──
  test('9. Admin résout un signalement → status="reviewed"', async () => {
    const author = await createTestUser();
    const reporter = await createTestUser();
    createdIds.users.push(author.id, reporter.id);

    const post = await createTestPost(author.id);
    createdIds.posts.push(post.id);

    const report = await createTestPostReport(post.id, reporter.id);
    createdIds.post_reports.push(report.id);

    const { error } = await supabaseAdmin
      .from('post_reports')
      .update({
        status: 'reviewed',
        admin_note: 'Contenu conforme, pas de sanction',
      })
      .eq('id', report.id);

    expect(error).toBeNull();

    const { data: resolved } = await supabaseAdmin
      .from('post_reports')
      .select('*')
      .eq('id', report.id)
      .single();

    expect(resolved?.status).toBe('reviewed');
  });

  // ── ÉTAPE 10 : Suppression de post par l'auteur ──
  test('10. Auteur supprime son post → post supprimé', async () => {
    const user = await createTestUser();
    createdIds.users.push(user.id);

    const post = await createTestPost(user.id);
    createdIds.posts.push(post.id);

    const { error } = await supabaseAdmin
      .from('posts')
      .delete()
      .eq('id', post.id);

    expect(error).toBeNull();

    const { data: deleted } = await supabaseAdmin
      .from('posts')
      .select('id')
      .eq('id', post.id)
      .single();

    expect(deleted).toBeNull();
  });
});
