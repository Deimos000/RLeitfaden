
import { Link } from "react-router-dom"; // Import Link from react-router-domasdasafafs
import "./CreateEntryPage.css";
import { useReplacements } from "./ReplacementContext"; // ⬅️

const defaultTerms = {
  "Kunde": "",
  "Elternteil 1": "",
  "Elternteil 2": "",
};

export default function TextReplacementPage({ onSave }) {
    const { replacements, setReplacements } = useReplacements();

  const handleChange = (term, value) => {
    setReplacements((prev) => ({
      ...prev,
      [term]: value,
    }));
  };

  const handleSubmit = () => {
    console.log("Saved replacements:", replacements);
    if (onSave) onSave(replacements);
    alert("Replacements saved!");
  };

  return (


    <div className="create-entry-container"> 
    <div className="menu-bar">
      <ul>
        <li><Link to="/">Home</Link></li>
        <li> <Link to={{ pathname: "/create-entry", }}> Create </Link></li>
        <li><Link to={{ pathname: "/create-connection", }}> Connection </Link></li>
        <li><Link to={{ pathname: "/delete-entry",  }}> Delete </Link></li>
        <li><Link to={{ pathname: "/set-name",  }}> names </Link></li>
      </ul>
    </div>


    <div className="replacement-container">
      <h2 className="replacement-title">🔁 Set Text Replacements</h2>
      <form className="replacement-form" onSubmit={(e) => e.preventDefault()}>
        {Object.keys(defaultTerms).map((term) => (
          <div className="form-group" key={term}>
            <label>{term} →</label>
            <input
              type="text"
              placeholder={`Replace "${term}" with...`}
              value={replacements[term]}
              onChange={(e) => handleChange(term, e.target.value)}
            />
          </div>
        ))}
        <button type="button" className="submit-button" onClick={handleSubmit}>
          Save Replacements
        </button>
      </form>
    </div>
    </div>
  );
}
