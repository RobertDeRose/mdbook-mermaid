use std::fs;
use std::process::Command;

use assert_cmd::cargo;
use assert_cmd::prelude::*;

#[test]
#[ignore = "requires mdbook on PATH; run explicitly in CI"]
fn builds_book_with_mermaid() {
    let tmp = tempfile::tempdir().expect("can't create tempdir");
    let root = tmp.path();
    fs::create_dir(root.join("src")).unwrap();
    fs::write(
        root.join("book.toml"),
        "[book]\ntitle = 'Mermaid smoke test'\n",
    )
    .unwrap();
    fs::write(
        root.join("src/SUMMARY.md"),
        "# Summary\n\n- [Diagrams](diagrams.md)\n",
    )
    .unwrap();
    fs::write(
        root.join("src/diagrams.md"),
        "# Diagrams\n\n```mermaid\nflowchart TD\n    A --> B\n```\n",
    )
    .unwrap();

    Command::new(cargo::cargo_bin!("mdbook-mermaid"))
        .arg("install")
        .arg(root)
        .assert()
        .success();

    // Use an absolute command path so the test doesn't depend on cargo's binary
    // directory being on PATH. Keep the assets installed by the real CLI.
    let config = root.join("book.toml");
    let contents = fs::read_to_string(&config).unwrap().replace(
        "command = \"mdbook-mermaid\"",
        &format!(
            "command = {}",
            serde_json::to_string(&cargo::cargo_bin!("mdbook-mermaid").to_string_lossy()).unwrap()
        ),
    );
    fs::write(config, contents).unwrap();

    let output = Command::new("mdbook")
        .arg("build")
        .arg(root)
        .assert()
        .success()
        .get_output()
        .clone();
    assert!(
        !String::from_utf8_lossy(&output.stderr).contains("Warning: The mdbook-mermaid"),
        "unexpected version warning: {}",
        String::from_utf8_lossy(&output.stderr)
    );

    let book = root.join("book");
    for page in ["diagrams.html", "print.html"] {
        let html = fs::read_to_string(book.join(page)).unwrap();
        assert!(html.contains("<pre class=\"mermaid\">flowchart TD"));
        assert!(html.contains("A --&gt; B"));
        assert!(!html.contains("language-mermaid"));

        // mdBook hashes asset filenames by default. Verify that all three
        // installed assets are both emitted and referenced by the HTML.
        for (prefix, extension) in [
            ("mermaid-", ".min.js"),
            ("mermaid-init-", ".js"),
            ("mermaid-modal-", ".css"),
        ] {
            let asset = fs::read_dir(&book)
                .unwrap()
                .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
                .find(|name| name.starts_with(prefix) && name.ends_with(extension))
                .expect("missing Mermaid asset");
            let attribute = if extension == ".css" { "href" } else { "src" };
            assert!(html.contains(&format!("{}=\"{}\"", attribute, asset)));
        }
    }
}
