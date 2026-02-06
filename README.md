## crosswithfriends

Crosswithfriends is an online website for sharing crosswords and playing collaboratively with friends in real time.

It is hosted at https://crosswithfriends.com/.

# 🚨 Repository Status & Branching Strategy

**Important:** This repository is currently in a transition phase between the Legacy Production app and the V2 Rewrite. Please ensure you are working on the correct branch.

| Environment    | Branch       | Status                                                                  | URL                                                        |
| :------------- | :----------- | :---------------------------------------------------------------------- | :--------------------------------------------------------- |
| **Production** | `master`     | 🔒 **Maintenance Only**<br>Critical hotfixes for the live app.          | [crosswithfriends.com](https://www.crosswithfriends.com)   |
| **V2**         | `v2-rewrite` | 🚀 **Active Development**<br>All new features and the rewrite codebase. | [v2.crosswithfriends.com](https://v2.crosswithfriends.com) |

---

## 🛠️ Which branch should I use?

### 1. Working on the New App (Default)

Most development should happen here. This is the new codebase (React/Vite/Node).
`git checkout v2-rewrite`
`git pull origin v2-rewrite`

### 2. Fixing a Bug in Production (Legacy)

Only check this out if you need to patch the currently live application.

    `git checkout master`
    `git pull origin master`

# ⚠️ Do not merge v2-rewrite into master!

## Contributing

If you notice a bug or have a feature request, feel free to open an issue.

### Getting Started

1. Install `nvm` and `yarn`

2. Clone repo and cd to repo root.

   `git clone https://github.com/ScaleOvenStove/crosswithfriends.git`
   `cd crosswithfriends`

3. Use node v18
   `nvm install`
   `nvm use`
   `nvm alias default 18` (optional)

4. Install Dependencies
   `yarn`

5. Run frontend server

   ```sh
   yarn start
   ```

   Or to do frontend development against the remote server:

   ```sh
   REACT_APP_STAGING_API_URL="downforacross-com.onrender.com" yarn start
   ```

### Development Workflow

This project uses ESLint, Prettier, and Jest. CI runs all of these on every pull request.

**Run tests:**

```sh
yarn test
```

**Lint:**

```sh
yarn eslint --ext .js,.jsx,.ts,.tsx src/ server/
```

**Check formatting:**

```sh
yarn prettier --check "src/**/*.{js,jsx,ts,tsx}" "server/**/*.{js,ts}"
```

**Production build:**

```sh
yarn build
```

A pre-commit hook (via Husky + lint-staged) automatically lints and formats staged files on commit.

### Contributing

Cross with Friends is open to contributions from developers of any level or experience.
See the `Getting Started` section for instructions on setting up.

Join the [discord](https://discord.gg/RmjCV8EZ73) for discussion.

### Tips

Developing for mobile web:

- Mobile device emulator: https://appetize.io/demo?device=nexus7&scale=50&orientation=portrait&osVersion=9.0
- Public urls for local server: ngrok, https://ngrok.com/
- Remote debugging (e.g. safari developer mode) tips: https://support.brightcove.com/debugging-mobile-devices

### Other resources

- https://firebase.google.com/docs/database/web/start (intro to firebase realtime database)
- https://reactjs.org/tutorial/tutorial.html (intro to react)
- https://discord.gg/RmjCV8EZ73 (community discord)
