module.exports = {
    apps: [
        {
            name: "SP_Sales_App",
            script: "node_modules/vite/bin/vite.js",
            args: "preview --port 5000 --host",
            env: {
                NODE_ENV: "development",
            },
            env_production: {
                NODE_ENV: "production",
            }
        }
    ]
};
