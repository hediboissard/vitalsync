# Argumentation E6 — Chaîne CI/CD conteneurisée

## Partie 1 — Git et gestion de versions

### Exercice 1 — Initialisation et structuration du dépôt

**Choix de GitHub** : GitHub a été choisi car il offre GitHub Actions nativement intégré pour la CI/CD, GitHub Container Registry (GHCR) pour stocker les images Docker, et une interface intuitive pour la gestion des branches et des Pull Requests.

**Justification du .gitignore** :
- `node_modules/` : Les dépendances npm sont installées via `npm install` et ne doivent pas être versionnées (volume important, recréables)
- `.env` : Contient des variables d'environnement sensibles (mots de passe, tokens) qui ne doivent jamais être exposées dans le dépôt
- `dist/` : Dossier de build généré automatiquement, recréable à chaque build
- `.DS_Store` : Fichier système macOS sans rapport avec le projet
- `*.log` : Fichiers de logs temporaires, inutiles dans le versioning
- `coverage/` : Rapports de couverture de tests générés par Jest, recréables
- `.docker-env` : Variables Docker sensibles similaires au .env

**Stratégie Gitflow** : Gitflow sépare le code stable (main) du code en développement (develop) et isole chaque fonctionnalité dans des branches feature/. Cela permet de travailler en parallèle sans impacter la branche de production.

**Protection de branche main** : Interdire le push direct sur main force le passage par des Pull Requests, ce qui garantit une revue de code et le passage de la CI avant toute mise en production.

### Exercice 2 — Workflow Git et résolution de conflits

**Merge vs Rebase** :
- **Git merge** : Crée un commit de fusion qui préserve l'historique complet des deux branches. L'historique montre clairement quand et comment les branches ont divergé puis convergé. Recommandé pour fusionner des branches feature dans develop ou develop dans main, car il préserve la traçabilité complète du projet.
- **Git rebase** : Réécrit l'historique en rejouant les commits d'une branche sur la pointe d'une autre, créant un historique linéaire. Recommandé pour mettre à jour une branche feature avec les derniers changements de develop avant de créer une PR, car cela simplifie l'historique et facilite la revue de code.
- **Règle d'or** : Ne jamais rebase une branche partagée/publique (comme main ou develop), car cela réécrit l'historique et crée des conflits pour les autres développeurs.

**Convention Conventional Commits** : Le format `type(scope): description` a été choisi car il permet de générer automatiquement des changelogs, de catégoriser les changements (feat, fix, docs, chore), et d'identifier rapidement la nature d'un commit dans l'historique. C'est le standard le plus répandu dans l'écosystème open source.

**Résolution du conflit** : Le conflit est survenu car les deux branches feature modifiaient la même ligne (console.log) dans server.js. La résolution a consisté à combiner les deux modifications en conservant les apports de chaque branche, vérifiant que le code résultant compile et fonctionne correctement.

## Partie 2 — Conteneurisation Docker

### Exercice 3 — Dockerfile du back-end

**Multi-stage build** : Le Dockerfile utilise 2 stages. Le premier (builder) installe toutes les dépendances (y compris devDependencies comme Jest et Supertest) et exécute les tests. Le second (production) ne copie que les dépendances de production et le code source, produisant une image finale beaucoup plus légère et sécurisée.

**Choix de node:20-alpine** : L'image Alpine Linux est environ 5 fois plus légère que l'image Debian standard (~180MB vs ~900MB). Elle réduit aussi la surface d'attaque en contenant moins de packages système. Node 20 est la version LTS active, garantissant stabilité et support long terme.

**Utilisateur non-root** : Un utilisateur `appuser` dédié est créé pour exécuter l'application, évitant de tourner en root dans le conteneur (bonne pratique de sécurité).

**HEALTHCHECK** : Intégré directement dans le Dockerfile pour que Docker puisse monitorer la santé du conteneur automatiquement.

**Justification du .dockerignore** :
- `node_modules` : Recréés dans le conteneur via npm ci, évite des conflits de plateforme
- `test` : Inutile en production (les tests sont déjà exécutés dans le stage builder)
- `.git` : Historique Git inutile dans l'image, réduit la taille
- `Dockerfile` / `.dockerignore` : Fichiers de config Docker inutiles dans l'image
- `coverage` / `.env` : Fichiers temporaires et secrets à ne pas inclure

### Exercice 4 — Dockerfile du front-end

**Choix de nginx:stable-alpine** : Image légère et stable, Nginx est le serveur HTTP le plus performant pour servir des fichiers statiques. La version Alpine réduit la taille de l'image (~40MB).

**Rôle du proxy_pass** : Les requêtes commençant par `/api/` sont redirigées (reverse proxy) vers le conteneur backend sur le port 3000. Cela permet au frontend et au backend de partager le même domaine du point de vue du navigateur, évitant les problèmes de CORS. Le frontend communique avec le backend via le réseau Docker interne grâce au nom de service `backend` défini dans docker-compose.

**try_files** : La directive `try_files $uri $uri/ /index.html` permet le fonctionnement correct d'une SPA (Single Page Application) en renvoyant toujours index.html pour les routes non trouvées.

### Exercice 5 — Docker Compose

**Réseau personnalisé (bridge)** : Un réseau `vitalsync-net` dédié isole les conteneurs du projet des autres conteneurs sur la machine. Contrairement au réseau bridge par défaut, un réseau personnalisé offre la résolution DNS automatique par nom de service (le frontend peut joindre le backend via le hostname `backend`), et une meilleure isolation réseau.

**Volume persistant `pgdata`** : Sans volume, les données PostgreSQL seraient stockées dans la couche écriture du conteneur. Un `docker-compose down` détruirait toutes les données. Le volume nommé `pgdata` persiste les données sur le disque de l'hôte indépendamment du cycle de vie du conteneur.

**Variables d'environnement** :
- `POSTGRES_DB` : Nom de la base de données à créer au premier démarrage
- `POSTGRES_USER` : Utilisateur PostgreSQL pour l'authentification
- `POSTGRES_PASSWORD` : Mot de passe de l'utilisateur (sensible, stocké dans .env non commité)
- `DATABASE_URL` : URL de connexion complète utilisée par le backend pour se connecter à PostgreSQL
- `NODE_ENV` : Définit le mode de fonctionnement de Node.js (production optimise les performances)

**depends_on avec condition** : Le backend attend que la base de données soit healthy avant de démarrer, évitant les erreurs de connexion au démarrage.

## Partie 3 — Pipeline CI/CD

### Exercice 6 — Configuration de la pipeline

**Choix de GitHub Actions** : Intégré nativement à GitHub, sans configuration de serveur externe. Les runners Ubuntu sont gratuits pour les dépôts publics. L'intégration avec GHCR est native via GITHUB_TOKEN.

**Étape 1 — Lint & Tests** : Installe les dépendances avec `npm ci` (installation propre et reproductible), exécute ESLint pour vérifier la qualité du code, puis Jest pour les tests unitaires. Si les tests échouent, la pipeline s'arrête immédiatement.

**Étape 2 — Build Docker & Push** : Construit les images Docker pour le backend et le frontend, les tag avec le SHA du commit ET latest. Le SHA garantit la traçabilité exacte (chaque image correspond à un commit précis), contrairement à `latest` qui est mutable et peut causer des ambiguïtés en production.

**Choix de GHCR (GitHub Container Registry)** : Intégré à GitHub, authentification automatique via GITHUB_TOKEN, pas de token supplémentaire à configurer. Les images sont liées au repository.

**Étape 3 — Déploiement staging** : Lance docker-compose en mode staging, attend que les services démarrent, puis exécute un health check HTTP sur /health. Si le health check retourne autre chose que 200, la pipeline échoue avec les logs du backend pour debug. Cela garantit qu'aucun déploiement cassé ne passe inaperçu.

**Health check** : Utilise curl pour vérifier que l'API répond correctement. Si la réponse n'est pas HTTP 200, la pipeline échoue. C'est un smoke test minimal mais essentiel qui vérifie que l'application démarre et que la route principale fonctionne.

### Exercice 7 — Gestion des secrets et déclencheurs

**Secrets configurés dans GitHub** :
- `GITHUB_TOKEN` (automatique) : Token d'authentification pour pousser des images sur GHCR. Fourni automatiquement par GitHub Actions, pas besoin de le configurer manuellement.
- `STAGING_DB_PASSWORD` : Mot de passe de la base de données pour l'environnement staging. Stocké dans les secrets GitHub pour ne jamais apparaître en clair dans les logs ou le code.

**Déclencheurs de la pipeline** :
- `push sur develop` : Chaque push sur develop déclenche la pipeline complète. Cela permet de valider en continu le code intégré par les développeurs et de détecter les régressions rapidement.
- `pull_request vers main` : Chaque PR vers main déclenche la pipeline. Cela garantit que le code qui arrive en production a été validé (tests, lint, build, health check) avant le merge.

**Pourquoi ne jamais stocker de secrets en clair dans un fichier CI** :
1. **Exposition dans l'historique Git** : Un secret commité est visible dans tout l'historique Git, même après suppression. Toute personne ayant accès au dépôt (ou à un fork) peut le récupérer.
2. **Fuites dans les logs CI** : Les fichiers de pipeline sont affichés dans les logs d'exécution. Un secret en clair apparaîtrait dans les logs accessibles à tous les collaborateurs.
3. **Propagation incontrôlée** : Si le dépôt est forké ou rendu public accidentellement, tous les secrets sont immédiatement compromis.
4. **Non-révocabilité** : Contrairement à un secret dans un vault, un secret dans Git ne peut pas être révoqué facilement — il faut réécrire l'historique.

## Partie 4 — Orchestration et supervision

### Exercice 8 — Manifestes Kubernetes

**Deployment** : Un Deployment gère le cycle de vie des pods. Il garantit qu'un nombre défini de réplicas est toujours en fonctionnement et permet des mises à jour rolling (sans downtime).

**2 réplicas** : Un seul réplica crée un point unique de défaillance (SPOF) — si le pod tombe, l'application est indisponible. Deux réplicas garantissent la haute disponibilité : si un pod tombe, l'autre continue de servir les requêtes pendant que Kubernetes recrée le pod défaillant. Trois réplicas n'est pas nécessaire pour une application de cette taille, mais serait recommandé en production critique pour supporter la charge et les mises à jour rolling.

**Liveness Probe** : Vérifie périodiquement que le conteneur est vivant en appelant GET /health. Si la probe échoue 3 fois consécutives (failureThreshold), Kubernetes redémarre automatiquement le pod. Cela détecte les situations où l'application est bloquée (deadlock, mémoire saturée) mais le processus tourne encore.

**Readiness Probe** : Vérifie que le pod est prêt à recevoir du trafic. Un pod non-ready est retiré du Service et ne reçoit plus de requêtes, évitant d'envoyer du trafic à un pod qui démarre ou qui a des problèmes.

**Service ClusterIP** : Expose le backend uniquement à l'intérieur du cluster Kubernetes. C'est le type par défaut et le plus sécurisé : le backend n'est pas directement accessible depuis l'extérieur, seul l'Ingress peut router le trafic vers lui.

**Ingress** : Choisi plutôt que NodePort ou LoadBalancer car il permet un routage HTTP avancé basé sur les paths (/api → backend, / → frontend) avec un seul point d'entrée. NodePort exposerait des ports arbitraires, et LoadBalancer créerait un load balancer cloud par service (coûteux).

**Secret Kubernetes** : Stocke le mot de passe de la base de données de manière chiffrée dans le cluster. Le secret est injecté comme variable d'environnement dans le pod via `env.valueFrom.secretKeyRef`, évitant de mettre des credentials en dur dans les manifestes de déploiement.
