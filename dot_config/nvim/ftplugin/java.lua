if vim.fn.executable("java") == 0 then
  return
end

if launcher == "" then
  return
end

local jdtls = require("jdtls")

local root_markers = { ".git", "mvnw", "gradlew", "pom.xml", "build.gradle" }
local root_dir = require("jdtls.setup").find_root(root_markers)

if not root_dir then
  return
end

local home = os.getenv("HOME")

local workspace_dir = home .. "/.cache/jdtls-workspace/" .. vim.fn.fnamemodify(root_dir, ":p:h:t")

local jdtls_path = "/home/9x14to03/Software/Source/github.com/eclipse-jdtls/eclipse.jdt.ls"
--- local jdtls_path = vim.fn.expand("~/Software/Source/github.com/eclipse-jdtls/eclipse.jdt.ls")

local launcher = vim.fn.glob(jdtls_path .. "/plugins/org.eclipse.equinox.launcher_*.jar")

local config_dir = jdtls_path .. "/config_linux"

local config = {
  cmd = {
    "java",

    "-Declipse.application=org.eclipse.jdt.ls.core.id1",
    "-Dosgi.bundles.defaultStartLevel=4",
    "-Declipse.product=org.eclipse.jdt.ls.core.product",
    "-Dlog.protocol=true",
    "-Dlog.level=ERROR",
    "-Xms1g",

    "-jar",
    launcher,
    "-configuration",
    config_dir,
    "-data",
    workspace_dir,
  },

  root_dir = root_dir,

  settings = {
    java = {},
  },
}

jdtls.start_or_attach(config)
