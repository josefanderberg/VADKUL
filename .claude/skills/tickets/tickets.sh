#!/bin/bash
# Ticketflödet mot GitHub-issues i josefanderberg/VADKUL. Läs SKILL.md bredvid.
#
#   tickets.sh lista [--alla]          grupperna med sina öppna tickets (träd, med prio-tagg)
#   tickets.sh nu | snart | sen        tickets per prioritet
#   tickets.sh grupp <namn>            en grupp: app android ios marknad outreach webb pipeline functions drift slapp
#   tickets.sh visa <nr>               en ticket med under-tickets
#   tickets.sh ny <grupp> "Titel" ["Brödtext"] [--snabb] [--ide] [--bug]
#   tickets.sh prio <nr> nu|snart|sen  sätter prioritet
#   tickets.sh gren <nr>               skapar och byter till grenen ticket/<nr>-<slug>
#   tickets.sh stang <nr> ["Kommentar"]
#   tickets.sh start <nr>              flyttar ticketen till Pågår på boarden
#   tickets.sh klar <nr> ["Kommentar"] committad men inte pushad: flyttar till Ska ut
#   tickets.sh paus <nr>               flyttar tillbaka till Kvar
#   tickets.sh pagar                   det som ligger i Pågår och Ska ut
#   tickets.sh board                   öppnar boarden i webbläsaren
set -euo pipefail
OWNER=josefanderberg
REPO=VADKUL
# Boarden: GitHub Project med Status-kolumnerna Kvar / Pågår / Ska ut / Klart.
# Kräver gh-behörigheten project på maskinen (gh auth refresh -s project).
PROJEKT=3

gql() { gh api graphql -f o="$OWNER" -f r="$REPO" "$@"; }

# Lägger issue <nr> på boarden (ligger den redan där händer inget) och skriver ut kortets id
board_add() {
  gh project item-add "$PROJEKT" --owner "$OWNER" \
    --url "https://github.com/$OWNER/$REPO/issues/$1" --format json --jq .id
}

# Flyttar issue <nr> till kolumnen <namn>: "Kvar", "Pågår", "Ska ut" eller "Klart"
board_status() {
  local nr="$1" kolumn="$2" item pid fid oid
  item=$(board_add "$nr") || return 1
  pid=$(gh project view "$PROJEKT" --owner "$OWNER" --format json --jq .id) || return 1
  read -r fid oid < <(gh project field-list "$PROJEKT" --owner "$OWNER" --format json \
    --jq ".fields[] | select(.name==\"Status\") | \"\(.id) \(.options[] | select(.name==\"$kolumn\") | .id)\"")
  [ -z "${oid:-}" ] && { echo "Hittar ingen kolumn \"$kolumn\" på boarden" >&2; return 1; }
  gh project item-edit --id "$item" --project-id "$pid" --field-id "$fid" \
    --single-select-option-id "$oid" >/dev/null || return 1
  echo "#$nr -> $kolumn"
}

board_miss() { echo "(boarden nåddes inte - saknar gh behörigheten project? kör: gh auth refresh -s project)" >&2; }

# Under-tickets till <nr>: rader "nr|STATE|titel|labels"
subissues() {
  gql -F n="$1" -f query='query($o:String!,$r:String!,$n:Int!){
    repository(owner:$o,name:$r){ issue(number:$n){
      subIssues(first:100){ nodes{ number state title labels(first:10){nodes{name}} } } } } }' \
    --jq '.data.repository.issue.subIssues.nodes[]
          | "\(.number)|\(.state)|\(.title)|\(.labels.nodes|map(.name)|join(","))"'
}

# Skriver ett träd under <nr> med indrag <prefix>; $ALLA=1 visar stängda också
tree() {
  local nr="$1" prefix="$2" rad n state title labels
  while IFS='|' read -r n state title labels; do
    [ -z "$n" ] && continue
    if [ "$state" != "OPEN" ] && [ "${ALLA:-0}" != "1" ]; then continue; fi
    local mark="" ; [ "$state" != "OPEN" ] && mark=" (stängd)"
    local tag=""
    case ",$labels," in *,prio:nu,*) tag=" [NU]";; *,prio:snart,*) tag=" [snart]";; *,prio:sen,*) tag=" [sen]";; esac
    case ",$labels," in *,snabb,*) tag="$tag [snabb]";; esac
    case ",$labels," in *,idé,*) tag="$tag [idé]";; esac
    case ",$labels," in *,bug,*) tag="$tag [bug]";; esac
    if [[ ",$labels," == *",ticketgrupp,"* ]]; then
      echo "${prefix}## $title (#$n)$mark"
      tree "$n" "${prefix}  "
    else
      echo "${prefix}- #$n $title$tag$mark"
    fi
  done < <(subissues "$nr")
}

cmd="${1:-lista}"; shift || true
case "$cmd" in
  lista)
    ALLA=0; [ "${1:-}" = "--alla" ] && ALLA=1; export ALLA
    gql -f query='query($o:String!,$r:String!){ repository(owner:$o,name:$r){
        issues(first:50, labels:["ticketgrupp"], states:[OPEN], orderBy:{field:CREATED_AT, direction:ASC}){
          nodes{ number title parent{ number } } } } }' \
      --jq '.data.repository.issues.nodes[] | select(.parent == null) | "\(.number)|\(.title)"' \
    | while IFS='|' read -r n title; do
        echo "# $title (#$n)"
        tree "$n" "  "
        echo
      done
    ;;
  nu|snart|sen)
    gh issue list --label "prio:$cmd" --state open --limit 100 --json number,title,labels \
      --jq 'sort_by(.number) | .[] | "- #\(.number) \(.title)  (\(.labels|map(.name)|map(select(startswith("grupp:")))|map(sub("grupp:";""))|join(", ")))"'
    ;;
  prio)
    nr="${1:?nummer saknas}"; p="${2:?nu, snart eller sen}"
    gh issue edit "$nr" --remove-label "prio:nu" --remove-label "prio:snart" --remove-label "prio:sen" >/dev/null 2>&1 || true
    gh issue edit "$nr" --add-label "prio:$p" >/dev/null && echo "#$nr -> prio:$p"
    ;;
  grupp)
    g="${1:?grupp saknas}"
    gh issue list --label "grupp:$g" --state open --limit 100 \
      --json number,title,labels \
      --jq '(map(select(.labels|map(.name)|index("ticketgrupp"))) | .[] | "## \(.title) (#\(.number))"),
            (map(select(.labels|map(.name)|index("ticketgrupp")|not)) | sort_by(.number) | .[] | "- #\(.number) \(.title)")'
    ;;
  visa)
    nr="${1:?nummer saknas}"
    gh issue view "$nr"
    echo
    echo "Under-tickets:"
    ALLA=1 tree "$nr" "  "
    ;;
  ny)
    g="${1:?grupp saknas}"; titel="${2:?titel saknas}"; shift 2
    body=""; labels="grupp:$g"
    for a in "$@"; do
      case "$a" in
        --snabb) labels="$labels,snabb";;
        --ide|--idé) labels="$labels,idé";;
        --bug) labels="$labels,bug";;
        *) body="$a";;
      esac
    done
    if [ -z "$body" ] && [[ ",$labels," != *",snabb,"* ]]; then
      body=$'**Vad:** \n\n**Varför:** \n\n**Klart när:** \n\n**Var:** '
    fi
    parent=$(gh issue list --label ticketgrupp --label "grupp:$g" --state open --json number --jq '.[0].number')
    [ -z "$parent" ] && { echo "Hittar ingen ticketgrupp med label grupp:$g" >&2; exit 1; }
    url=$(gh issue create --title "$titel" --label "$labels" --body "$body")
    nr="${url##*/}"
    pid=$(gh issue view "$parent" --json id --jq .id)
    cid=$(gh issue view "$nr" --json id --jq .id)
    gql -f p="$pid" -f c="$cid" -f query='mutation($p:ID!,$c:ID!){ addSubIssue(input:{issueId:$p, subIssueId:$c}){ issue{number} } }' >/dev/null
    echo "#$nr skapad under #$parent: $url"
    board_status "$nr" "Kvar" >/dev/null || board_miss
    ;;
  start)
    nr="${1:?nummer saknas}"
    board_status "$nr" "Pågår" || { board_miss; exit 1; }
    ;;
  klar)
    nr="${1:?nummer saknas}"; kommentar="${2:-}"
    board_status "$nr" "Ska ut" || { board_miss; exit 1; }
    if [ -n "$kommentar" ]; then
      gh issue comment "$nr" --body "$kommentar" >/dev/null && echo "kommentar skriven på #$nr"
    fi
    ;;
  paus)
    nr="${1:?nummer saknas}"
    board_status "$nr" "Kvar" || { board_miss; exit 1; }
    ;;
  pagar)
    gh project item-list "$PROJEKT" --owner "$OWNER" --limit 500 --format json \
      --jq '.items | map(select(.content.number != null)) as $i
            | ("Pågår:", ($i | map(select(.status=="Pågår")) | sort_by(.content.number) | .[] | "- #\(.content.number) \(.content.title)"),
               "", "Ska ut (committat, inte pushat):",
               ($i | map(select(.status=="Ska ut")) | sort_by(.content.number) | .[] | "- #\(.content.number) \(.content.title)"))' \
      || { board_miss; exit 1; }
    ;;
  board)
    gh project view "$PROJEKT" --owner "$OWNER" --web
    ;;
  gren)
    nr="${1:?nummer saknas}"
    titel=$(gh issue view "$nr" --json title --jq .title)
    slug=$(printf '%s' "$titel" | tr '[:upper:]' '[:lower:]' | sed -E 'y/åäöé/aaoe/' | sed -E 's/[^a-z0-9]+/-/g; s/^-|-$//g' | cut -c1-40 | sed -E 's/-$//')
    git switch -c "ticket/$nr-$slug"
    ;;
  stang)
    nr="${1:?nummer saknas}"; kommentar="${2:-}"
    board_status "$nr" "Klart" >/dev/null || board_miss
    if [ -n "$kommentar" ]; then gh issue close "$nr" --comment "$kommentar"; else gh issue close "$nr"; fi
    ;;
  *)
    sed -n '2,16p' "$0"; exit 1;;
esac
